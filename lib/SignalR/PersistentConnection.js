var util = require("util"), 
    http = require("http"),
    url = require("url"),
    qs = require("querystring"),
    uuid = require("./node-uuid/uuid");
    
/*------------------------------------------------------------------------------
  (public) SignalR
  
  + options - { 
		name,
        server
    }
  - void
  
  Set up SignalR server.
------------------------------------------------------------------------------*/
var SignalR = module.exports = function SignalR(options) {
    // browser sessions store
    this._sessions = {};
    
    // total number of active sessions
    this._sessionsCount = 0;
	
	// message identifier
	this._messageId = 0;

    // long poll timeout
    this._pollTimeout = 5000;
    
	// name
    this._name = options.name || 'signalr';
	
    // http server
    this._httpServer = options.server;
};

SignalR.prototype = new process.EventEmitter();

/*------------------------------------------------------------------------------
  (public) sessionsCount
  
  - get

  Getter for total number of active sessions.
------------------------------------------------------------------------------*/
Object.defineProperty(SignalR.prototype, "sessionsCount", {
    get: function() {
        return this._sessionsCount;
    }
});

/*------------------------------------------------------------------------------
  (private) _garbageCollectionInterval
  
  + none
  - void
  
  Periodical interval for cleaning up old messages
------------------------------------------------------------------------------*/
SignalR.prototype._garbageCollectionInterval = function() {
	var self = this,
        expiration, item, session;

	setTimeout(function () {
        expiration = new Date().getTime() - 15000;

		for (item in self._sessions) {
            session = self._sessions[item];
        
            if (session) {
				var message, messageItem;

				for (messageItem in session.messages) {
					message = session.messages[messageItem];
					
					if (message && (message.timestamp < expiration)) {
						delete session.messages[messageItem];
					}
				}
            }
        }

		self._disconnectionInterval();
	}, 15000);
};

/*------------------------------------------------------------------------------
  (private) _disconnectionInterval
  
  + none
  - void
  
  Periodical interval for disconnecting sessions which were left with opened 
  connection. This situation may happen when user closes tab or browser at
  the time of assigning new poll request.
------------------------------------------------------------------------------*/
SignalR.prototype._disconnectionInterval = function() {
	var self = this,
        expiration, item, session;

	setTimeout(function () {
        expiration = new Date().getTime() - 60000;

		for (item in self._sessions) {
            session = self._sessions[item];
        
            if (session && (session.timestamp < expiration)) {
                delete self._sessions[session.clientId];
                self._sessionsCount--;
				
				// emit event about disconnected session
				self.emit("disconnect", session.clientId);
            }
        }

		self._disconnectionInterval();
	}, 60000);
};

/*------------------------------------------------------------------------------
  (private) _negotiate
  
  + request - incoming http request
  + response - outgoing http response
  + queryString - JSON representation of query string
  - void
  
  Processes incoming negotiation from new client.
------------------------------------------------------------------------------*/
SignalR.prototype._negotiate = function(request, response, queryString) {
	var responseObject = {
		"Url": "/" + this._name,
		"ClientId": uuid(),
		"TryWebSockets": false,
		"WebSocketServerUrl": null,
		"ProtocolVersion": "1.0"
	};

    this._sendResponse(response, responseObject);
};
		
/*------------------------------------------------------------------------------
  (private) _connect
  
  + request - incoming http request
  + response - outgoing http response
  + queryString - JSON representation of query string
  - void
  
  Processes incoming connection from new client.
------------------------------------------------------------------------------*/
SignalR.prototype._connect = function(request, response, queryString) {
	var self = this;
	
	var data = '';
	request.on('data', function(chunk) {
		data += chunk.toString();
	});
	request.on('end', function() {
		data = qs.parse(data);
		
		var clientId = data.clientId || false;
		var session;
		var responseObject = {};
		
		// if clientId exists - check if session object exist
		// else - create new clientId and session object
		if (clientId) {
			session = self._sessions[clientId];
		}
		
		// if session is found - ok
		// else - create new session object
		if (session && session.clientId) {
		} else {
			session = { 
				clientId: clientId || uuid(), 
				messages: [],
				timestamp: new Date().getTime(),
				pollTimeOut: 0
			};
			
			self._sessions[session.clientId] = session;
			self._sessionsCount++;
			
			// emit event about new connected session
			self.emit("connect", clientId);
		}
								
		if (session && session.clientId) {
			// Update session
			session.clientId = clientId || uuid();
			session.timestamp = new Date().getTime();
			session.messageId = data.messageId;
			if (data.messageId == "null") {
				session.messageId = self._messageId || 0;
			}
			session.transport = data.transport; 
			session.connectionData = data.connectionData || [];
			session.groups = data.groups || [];
			
			// Add messages
			var messages = [];
			var message;
			var messageId = session.messageId;
			var lastMessageId = messageId;
			for (var item in session.messages) {
				if (item >= messageId) {
					message = session.messages[item];
					lastMessageId = item;
					messages.push(message.payload);
				}
			}
			
			// Adjust polltimeout (backoff mechanism)
			if (lastMessageId > messageId) {
				session.pollTimeOut = 0;
			} else {
				if (session.pollTimeOut < self._pollTimeOut) {
					session.pollTimeOut += 1000;
				}
			}
			
			// Create response
			responseObject = {
				"MessageId": lastMessageId,
				"TransportData": {
					"LongPollDelay": session.pollTimeout,
					"Groups": session.groups
				}
			};
				
			// emit event about new connected session
			if (messages) {
				self.emit("sending", clientId, messages);
				responseObject.Messages = messages;
			}
		}    
		
		self._sendResponse(response, responseObject);
	});
	
	return;
};

/*------------------------------------------------------------------------------
  (private) _send
  
  + request - incoming http request
  + response - outgoing http response
  + queryString - JSON representation of query string
  - void
  
  Processes incoming send requests from client.
------------------------------------------------------------------------------*/
SignalR.prototype._send = function(request, response, queryString) {
	var self = this;
	
	var data = '';
	request.on('data', function(chunk) {
		data += chunk.toString();
	});
	request.on('end', function() {
		data = qs.parse(data);
		
		var clientId = data.clientId || false;
		
		if (clientId && data.data) {
			// emit event about received data
			self.emit("received", clientId, data.data);
			
			session = self._sessions[clientId];
			if (session && session.clientId) {
				session.timestamp = new Date().getTime();
			}
		}

		self._sendResponse(response, {});
	});
	
	return;
};

/*------------------------------------------------------------------------------
  (private) _sendResponse
  
  + request - incoming http request
  + content - message which will be sent in response
  
  Send response to client with array of messages in JSONP format.
------------------------------------------------------------------------------*/
SignalR.prototype._sendResponse = function(response, content) {
	response.writeHead(200, {"Content-Type": "application/json"});
	response.write(
		JSON.stringify(content)
	);
	response.end();
};

/*------------------------------------------------------------------------------
  (public) init
  
  + none
  - void
  
  Initialize SignalR server.
------------------------------------------------------------------------------*/
SignalR.prototype.init = function() {
	var self = this;

	this._httpServer.addListener("request", function(request, response) {
		var path = url.parse(request.url).pathname;

		switch(path) {
			case "/" + self._name + "/negotiate":
				self._negotiate(
					request, 
					response,
					url.parse(request.url, true).query
				);			
				break;
			case "/" + self._name:
			case "/" + self._name + "/connect":
				self._connect(
					request, 
					response,
					url.parse(request.url, true).query
				);
				break;
			case "/" + self._name + "/send":
				self._send(
					request, 
					response, 
					url.parse(request.url, true).query
				);
				break;
			default:
				break;
		}
    });

	// start message garbage collector
	self._garbageCollectionInterval();
	
    // start periodical interval for disconnecting clients which were left with
    // opened connection for long period
	self._disconnectionInterval();
};

/*------------------------------------------------------------------------------
  (public) send
  
  + clientID
  + message
  - void
  
  Sends message to particular client.
------------------------------------------------------------------------------*/
SignalR.prototype.send = function(clientID, message) {
    var session = this._sessions[clientID];
    
    if (session) {
		var messageId = this._messageId++;
        session.messages[messageId] = {
			timestamp: new Date().getTime(),
			payload: message,
			messageId: messageId
		};
    }
};

/*------------------------------------------------------------------------------
  (public) broadcast
  
  + message - object to be broadcasted
  - void
  
  Broadcasts passed message to all connected clients.
------------------------------------------------------------------------------*/
SignalR.prototype.broadcast = function(message) {
    var session, item;

    for (item in this._sessions) {
        this.send(item, message);
    }
};