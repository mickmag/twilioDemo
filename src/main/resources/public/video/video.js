var activeRoom;
var previewTracks;
var identity;
var roomName;

function attachTracks(tracks, container) {
    tracks.forEach(function (track) {
        container.appendChild(track.attach());
    });
}

function attachParticipantTracks(participant, container) {
    var tracks = Array.from(participant.tracks.values());
    attachTracks(tracks, container);
}

function detachTracks(tracks) {
    tracks.forEach(function (track) {
        track.detach().forEach(function (detachedElement) {
            detachedElement.remove();
        });
    });
}

function detachParticipantTracks(participant) {
    var tracks = Array.from(participant.tracks.values());
    detachTracks(tracks);
}

// Check for WebRTC
if (!navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
    alert('WebRTC is not available in your browser.');
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);


function initVideo(data) {
    identity = data.identity;
    document.getElementById('room-controls').style.display = 'block';

    // Bind button to join room
    document.getElementById('button-join').onclick = function () {
//    roomName = document.getElementById('room-name').value;
        roomName = "test";
        if (roomName) {
//            print("Joining room '" + roomName + "'...");
            print('Vstupujete do videokonference.');

            var connectOptions = {name: roomName, logLevel: 'debug'};
            if (previewTracks) {
                connectOptions.tracks = previewTracks;
            }

            Twilio.Video.connect(data.token, connectOptions).then(roomJoined, function (error) {
                print('Could not connect to Twilio: ' + error.message);
            });
        } else {
            alert('Please enter a room name.');
        }
    };

    // Bind button to leave room
    document.getElementById('button-leave').onclick = function () {
//        print('Opouštíte videokonferenci...');
        activeRoom.disconnect();
    };
}

//$.getJSON('/token', function(data) {
//  identity = data.identity;
//
//  document.getElementById('room-controls').style.display = 'block';
//
//  // Bind button to join room
//  document.getElementById('button-join').onclick = function () {
////    roomName = document.getElementById('room-name').value;
//    roomName = "test";
//    if (roomName) {
//      print("Joining room '" + roomName + "'...");
//
//      var connectOptions = { name: roomName, logLevel: 'debug' };
//      if (previewTracks) {
//        connectOptions.tracks = previewTracks;
//      }
//
//      Twilio.Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
//        print('Could not connect to Twilio: ' + error.message);
//      });
//    } else {
//      alert('Please enter a room name.');
//    }
//  };
//
//  // Bind button to leave room
//  document.getElementById('button-leave').onclick = function () {
//    print('Leaving room...');
//    activeRoom.disconnect();
//  };
//});

// Successfully connected!
function roomJoined(room) {
    activeRoom = room;


    print('Jste pøipojen do videokonference jako uživatel: '
            + '<span class="me">' + identity + '</span>', true);
//    print("Pøipojen do videokonfernce jako uživatel '" + identity + ".'");
    document.getElementById('button-join').style.display = 'none';
    document.getElementById('button-leave').style.display = 'inline';

    // Draw local video, if not already previewing
    var previewContainer = document.getElementById('local-media');
    if (!previewContainer.querySelector('video')) {
        attachParticipantTracks(room.localParticipant, previewContainer);
    }

    room.participants.forEach(function (participant) {
        print('Ve videokonferenci je již pøipojen uživatel: <span class="username">' + participant.identity + "</span>",true);
        var previewContainer = document.getElementById('remote-media');
        attachParticipantTracks(participant, previewContainer);
    });

    // When a participant joins, draw their video on screen
    room.on('participantConnected', function (participant) {
        print('Uživatel <span class="username">'+ participant.identity + '</span> se pøipojil do videokonference.', true);
    });

    room.on('trackAdded', function (track, participant) {
//        print(participant.identity + " added track: " + track.kind);
        var previewContainer = document.getElementById('remote-media');
        attachTracks([track], previewContainer);
    });

    room.on('trackRemoved', function (track, participant) {
//        print(participant.identity + " removed track: " + track.kind);
        detachTracks([track]);
    });

    // When a participant disconnects, note in log
    room.on('participantDisconnected', function (participant) {
        print('Uživatel <span class="username">' + participant.identity + '</span> opustil videokonferenci.', true);
        detachParticipantTracks(participant);
    });

    // When we are disconnected, stop capturing local video
    // Also remove media for all remote participants
    room.on('disconnected', function () {
        print('Jste odpojen z videokonference.');
        detachParticipantTracks(room.localParticipant);
        room.participants.forEach(detachParticipantTracks);
        activeRoom = null;
        document.getElementById('button-join').style.display = 'inline';
        document.getElementById('button-leave').style.display = 'none';
    });
}

//  Local video preview
document.getElementById('button-preview').onclick = function () {
    var localTracksPromise = previewTracks
            ? Promise.resolve(previewTracks)
            : Twilio.Video.createLocalTracks();

    localTracksPromise.then(function (tracks) {
        previewTracks = tracks;
        var previewContainer = document.getElementById('local-media');
        if (!previewContainer.querySelector('video')) {
            attachTracks(tracks, previewContainer);
        }
    }, function (error) {
        console.error('Unable to access local media', error);
        print('Unable to access Camera and Microphone');
    });
};


// Activity log
function log(message) {
    var logDiv = document.getElementById('log');
    logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
    logDiv.scrollTop = logDiv.scrollHeight;
}

function leaveRoomIfJoined() {
    if (activeRoom) {
        activeRoom.disconnect();
    }
}
