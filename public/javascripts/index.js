var App = function(){
	var socket = null;
	var context = null;
	var init = function (){
		console.log("init");
		initSocket();
		context = new webkitAudioContext();
	};

	var notes = [];

	var initSocket = function (){
		if(socket) return; // already initialized

		// socket.io initialiseren
		socket = io.connect(window.location.hostname);
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
			// noteOn
			// noteOn with velocity 0 = noteOff
			if(message[2] == 0)
				noteOff(message[1], message[2], channel);
			else noteOn(message[1], message[2], channel);

		}
	};

	var noteOn = function(note, velocity, channel){

		var oscillator = context.createOscillator();
		var gainNode = context.createGainNode();
		if(0 <= channel && channel <= 3)
			// Sine wave is type = 0 -> default
			// Square wave is type = 1
			// Sawtooth wave is type = 2
			// Triangle wave is type = 3
			oscillator.type = channel;
		oscillator.frequency.value = 440 * Math.pow(2,(note-69)/12); //note to frequency mapping
		oscillator.connect(gainNode);
		gainNode.connect(context.destination);
		gainNode.gain.value = 0.1 + 0.9 * velocity / 127.0;
		if(notes[note]) notes[note].noteOff();
		notes[note] = oscillator;
		notes[note].noteOn(0);
	}

	var noteOff = function(note, velocity, channel){
		if(notes[note]){
			notes[note].noteOff(0);
			notes[note] = null;
		}

	}

	return {
		init: init
	};
};

$(function(){
	var app = new App();
	app.init();
});

