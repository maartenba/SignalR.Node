# SignalR.Node
Async signaling library for .NET and NodeJS to help build real-time, multi-user interactive web applications.

## What can it be used for?
Pushing data from the server to the client (not just browser clients) has always been a tough problem. SignalR makes it dead easy and handles all the heavy lifting for you.

SignalR.Node can be compared with Socket.IO and Minotaur.

## Why SignalR.Node?
When building web applications, chances are you are standardizing on one technology, for example .NET and SignalR. Using SignalR.Node, parts of the application can be built using the JavaScript evrsion of SignalR without having to build multiple clients.

## Example
The following creates a NodeJS HTTP Server:

    	var http = require("http");
    	    util = require("util"),
    	    fs = require("fs"),
    	    SignalR = require("../../lib/SignalR");
    	
    	var httpServer = http.createServer(function(req, res) {
    	    // resource handling
    	});
    	httpServer.listen(8080);
    	util.log("Running on 8080");

SignalR.Node features a PersistentConnection class which makes it easy to register a given endpoint, for example "time" to a given handler:

    	var connection = new SignalR.PersistentConnection({
    		name: 'time',
    		server: httpServer
    	});
    	connection.init();

Using the connection, various actions can be performed:

    	connection.on("connect", function(clientId, data) {
    		console.log("New connection, total: " + connection.sessionsCount);
    	});
    	connection.on("disconnect", function(clientId, data) {
    		console.log("Closed connection, total: " + connection.sessionsCount);
    	});
    	connection.on("received", function(clientId, data) {
    		console.log(data);
    	});

Additionally, messages can be sent to one client or broadcasted to all clients:

    	setInterval(function() {
    		connection.broadcast(new Date().toString());
    	}, 1000);

Using SignalR's client-side JavaScript, which can be obtained from [GitHub](https://github.com/SignalR/SignalR), a client for this PersistentConnection can be created:

    	<script type="text/javascript">
    	    $(function () {
    	        var connection = $.connection('time');
    	
    	        connection.received(function (data) {
    	            $('h1').text('The time is ' + data);
    	        });
    	
    	        connection.start();
    	    });
    	</script>


## License
[MIT License](https://github.com/maartenba/SignalR.Node/blob/master/LICENSE.md)

## Differences with SignalR for .NET
- No support for multiple transports (currently only long polling)
- No support for Websockets
- Only PersistentConnection has been implemented, Hubs are not available at this time