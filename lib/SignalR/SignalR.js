var persistentConnection = require("./PersistentConnection");

/*------------------------------------------------------------------------------
  (public) SignalR
  
  - void
  
  SignalR namespace
------------------------------------------------------------------------------*/
var SignalR = module.exports = function SignalR() {
	this.PersistentConnection = persistentConnection;
};

module.exports.PersistentConnection = persistentConnection;