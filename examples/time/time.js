var http = require("http");
    util = require("util"),
    fs = require("fs"),
    SignalR = require("../../lib/SignalR");

var httpServer = http.createServer(function(req, res) {
    switch(req.url) {
        case "/":
		case "/time.htm":
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(fs.readFileSync(__dirname + '/approot/time.htm'));
            res.end();
            break;
        case "/favicon.ico":
            res.writeHead(200, {'Content-Type': 'image/x-icon'} )
            res.end();
            break;
        default:
			if (req.url.indexOf('Scripts') >= 0) {
				res.writeHead(200, {'Content-Type': 'text/javascript'});
				res.write(fs.readFileSync(__dirname + '/approot/' + req.url));
				res.end();
			}
            break;
    }
});
httpServer.listen(8080);
util.log("Running on 8080");

// set up SignalR PersistentConnection with settings
var connection = new SignalR.PersistentConnection({
	name: 'time',
	server: httpServer
});
connection.init();

connection.on("connect", function(clientId, data) {
	console.log("New connection, total: " + connection.sessionsCount);
});
connection.on("disconnect", function(clientId, data) {
	console.log("Closed connection, total: " + connection.sessionsCount);
});
connection.on("received", function(clientId, data) {
	console.log(data);
});

setInterval(function() {
	connection.broadcast(new Date().toString());
}, 1000);