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

// Set up a new input (= output for other program e.g. garageband with midio (http://www.bulletsandbones.com/GB/GBFAQ.html#getmidio))
var midiInput = new midi.input();
// virtual ports; we don't have actual midi device connected
midiInput.openVirtualPort("Test Input");

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
	io.sockets.emit('midi', message);
    console.log(mapping.parseMessage(message));
});
