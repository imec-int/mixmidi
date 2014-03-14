#!/usr/bin/env node

var midi = require('midi');
var mapping = require('./midimapping');
var express = require('express');
var http = require('http');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var socketio = require('socket.io');
var fs = require('fs');
var async = require('async');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + server.address().port);
});

var io = socketio.listen(server);
io.set('log level', 0);
// test xhr polling
// io.set('transports', ['xhr-polling']);


app.get('/', function (req, res){
	res.render('index', { title: 'Hello World' });
});

// MIDI CONFIG

var isRecording = false;
var midiBuffer = [];
var stopPlaying = false;
var playingNotes = {};

// Set up a new input (= output for other program e.g. garageband with midio (http://www.bulletsandbones.com/GB/GBFAQ.html#getmidio))
var midiInput = new midi.input();
if(midiInput.getPortCount() > 0){
	console.log("Using " + midiInput.getPortName(0)); // USB MIDI 1x1 Port 1 for Kasper's device
	midiInput.openPort(0);
} else{
	// open virtual port; in case we don't have actual midi device connected
	console.log("Using virtual MIDI device");
	midiInput.openVirtualPort("Test Input");
}

// Set up output (=input via midi instead of ws for other program e.g. http://webaudiodemos.appspot.com/midi-synth/index.html)
// first enable web-midi-api in chrome://flags )
// var midiOutput = new midi.output();
// midiOutput.openVirtualPort('Test Output');

// Sysex, timing, and active sensing messages are ignored
// by default. To enable these message types, pass false for
// the appropriate type in the function below.
// Order: (Sysex, Timing, Active Sensing)
// input.ignoreTypes(false, false, false);

// Configure a callback.
midiInput.on('message', function(deltaTime, message) {
	// next line sends to other midi device as well
	// midiOutput.sendMessage(message);
	if(isRecording){
		midiBuffer.push({deltaTime: deltaTime, message: message});
		// keep track of which notes are playing with velocity different from 0
		if(message.length == 3 && message[0] >> 4 == 0x9 && message[2] != 0){
			if(!playingNotes[message[0]]) playingNotes[message[0]] = {}; // this object will contain the playing notes per channel (channel is encoded in message[0])
			playingNotes[message[0]][message[1]] = true;
		}
	}
	io.sockets.emit('midi', message);
    console.log(mapping.parseMessage(message));
});

function startRecording() {
	isRecording = true;
}

function stopRecording() {
	isRecording = false;
	// stop playing notes that are still playing
	var firstParts = Object.keys(playingNotes); // this contains noteOn && channel
	for(var i = 0; i < firstParts.length; i++){
		// console.log(firstParts[i]);
		var secondParts = Object.keys(playingNotes[firstParts[i]]); // this contains which note
		for(var j = 0; j < secondParts.length; j++){
			// velocity 0 is same as note off -> turn them all off
			midiBuffer.push({deltaTime: 0, message: [firstParts[i], secondParts[j], 0]})
		}
	}
	fs.writeFileSync(__dirname + '/mididata/' + Date.now(), JSON.stringify(midiBuffer));
	console.log('recording stopped');
	midiBuffer = [];
	playingNotes = {};
}

function playFile(fileName) {
	stopPlaying = false;
	fs.readFile(fileName, function(err, data){
		if(err){
			console.log(err);
			return;
		}
		playNextSamples(JSON.parse(data));
	});
}

var currentSample = 0;
function playNextSamples(samples, callback){
	if(currentSample < samples.length && !stopPlaying){
		setTimeout(function(){
			if(callback && currentSample == samples.length - 1) {// op laatste sample -> callback voor loop
				// also keep track of playing stuff for haltPlaying function
				var message = samples[currentSample].message;
				if(message.length == 3 && message[0] >> 4 == 0x9 && message[2] != 0){
					if(!playingNotes[message[0]]) playingNotes[message[0]] = {}; // this object will contain the playing notes per channel (channel is encoded in message[0])
					playingNotes[message[0]][message[1]] = true;
				}
				io.sockets.emit('midi', samples[currentSample].message);
				// console.log(message);
				return callback(null);
			}
			// also keep track of playing stuff for haltPlaying function
			var message = samples[currentSample].message;
			if(message.length == 3 && message[0] >> 4 == 0x9 && message[2] != 0){
				if(!playingNotes[message[0]]) playingNotes[message[0]] = {}; // this object will contain the playing notes per channel (channel is encoded in message[0])
				playingNotes[message[0]][message[1]] = true;
			}
			io.sockets.emit('midi', samples[currentSample++].message);
			// console.log(message);
			playNextSamples(samples, callback);
		}, samples[currentSample].deltaTime * 1000.0); //deltaTime is in seconds instead of milliseconds
	}
}

function loopFile(fileName){
	stopPlaying = false;
	fs.readFile(fileName, function(err, data){
		if(err){
			console.log(err);
			return;
		}
		var samples = JSON.parse(data);
		async.whilst(
			function() { return stopPlaying != true;},
			function(callback) {
				console.log('next iteration');
				currentSample = 0;
				playNextSamples(samples, callback);
			},
			function(err) {
				console.log('loop stopped');
			}
		);
	});
}

function haltPlaying(){
	stopPlaying = true;
	console.log('stop playing');
	// stop playing notes that are still playing. Do this after timeout, cause some notes might still be playing
	setTimeout(function(){
		var firstParts = Object.keys(playingNotes); // this contains noteOn && channel
		for(var i = 0; i < firstParts.length; i++){
			// console.log(firstParts[i]);
			var secondParts = Object.keys(playingNotes[firstParts[i]]); // this contains which note
			for(var j = 0; j < secondParts.length; j++){
				// velocity 0 is same as note off -> turn them all off
				io.sockets.emit('midi', [firstParts[i], secondParts[j], 0]);
				// console.log(JSON.stringify(playingNotes));
			}
		}
		playingNotes = {};
	}, 2000);
}

function listFiles(callback){
	fs.readdir(__dirname + '/mididata/', callback);
}

// startRecording();
// setTimeout(stopRecording, 20000);
// loopFile(__dirname + '/mididata/1394806910624');
// setTimeout(haltPlaying, 5000);
// listFiles(function(err, data){console.log(data);});

// if recording and Ctrl-C: stop
process.on('SIGINT',
	function () {
		if(isRecording)
			stopRecording();
		process.exit();
	}
);

