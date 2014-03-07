$(function(){
	var app = new App();
	context = new webkitAudioContext();
	notes = [];
	app.init(function(){
		app.onNoteOn(function(note, velocity, channel){
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
			if(notes[note]) notes[note].noteOff(0);
			notes[note] = oscillator;
			notes[note].noteOn(0);
		});

		app.onNoteOff(function(note, velocity, channel){
			if(notes[note]){
				notes[note].noteOff(0);
				notes[note] = null;
			}

		});
	});
});
