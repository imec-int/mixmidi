var App = function(){
	var socket = null;
	var context = null;
	var init = function (callback){
		console.log("init");

		$.getScript("http://dev1.mixlab.be:3000/socket.io/socket.io.js", function(){
			initSocket();
			callback();
		});
	};
	var onNoteOnHandler, onNoteOffHandler;
	var notes = [];

	var initSocket = function (){
		if(socket) return; // already initialized

		// socket.io initialiseren
		socket = io.connect('http://dev1.mixlab.be:3000');
		// some debugging statements concerning socket.io
		socket.on('reconnecting', function(seconds){
			console.log('reconnecting in ' + seconds + ' seconds');
		});
		socket.on('reconnect', function(){
			console.log('reconnected');
			// onRefreshPage();
		});
		socket.on('reconnect_failed', function(){
			console.log('failed to reconnect');
		});
		socket.on('midi', processMidi);
	};
	var processMidi = function(message){
		var eventType = message[0] >> 4;
		var channel = message[0] & 0x0f;
		if(eventType == 0x08){
			// noteOff
			noteOff(message[1], message[2], channel);

		}
		if(eventType == 0x09){
			if(message[2] == 0)
				noteOff(message[1], message[2], channel);
			else noteOn(message[1], message[2], channel);

		}
	};

	var noteOn = function(note, velocity, channel){
		onNoteOnHandler(note, velocity, channel);
	}

	var noteOff = function(note, velocity, channel){
		onNoteOffHandler(note, velocity, channel);
	}
	var onNoteOn = function(callback){
		onNoteOnHandler = callback;
	}
	var onNoteOff = function(callback){
		onNoteOffHandler = callback;
	}
	return {
		init: init,
		onNoteOn: onNoteOn,
		onNoteOff: onNoteOff
	};

};


