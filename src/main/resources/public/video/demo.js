//$(function () {
    /* video variables */
    var activeRoom;
    var previewTracks;
    var identity;
    var roomName;    
    var fallbackRoomName="testFallbackRoom";
    
    
    /* chat variables */
    var $chatWindow = $('#messages');
    // Our interface to the Chat service
    var chatClient;
    // A handle to the chat channel - the one and only channel we
    // will have in this sample app
    var chatChannel;        
    // channel name
    var channelName;
    var fallbackChatChannelName="testFallbackChannel";
    // The server will assign the client a random username - store that value
    // here
    var username;
    
    /* chat */
    // Helper function to print info messages to the chat window
    function print(infoMessage, asHtml) {
        var $chatWindow = $('#messages');
        var $msg = $('<div class="info">');
        if (asHtml) {
            $msg.html(infoMessage);
        } else {
            $msg.text(infoMessage);
        }
        $chatWindow.append($msg);
        $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }


    // Helper function to print chat message to the chat window
    function printMessage(fromUser, message) {
        var $user = $('<span class="username">').text(fromUser + ':');
        if (fromUser === username) {
            $user.addClass('me');
        }
        var $message = $('<span class="message">').text(message);
        var $container = $('<div class="message-container">');
        $container.append($user).append($message);
        $chatWindow.append($container);
        $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }

    // Alert the user they have been assigned a random username
    print('Pøipojování...');
    // Get an access token for the current user, passing a username (identity)
    $.getJSON('/token', function (data) {        
        initVideo(data);
        // Initialize the Chat client
        Twilio.Chat.Client.create(data.token).then(client => {
            console.log('Created chat client');
            chatClient = client;
            channelName = data.chatChannel ? data.chatChannel : fallbackChatChannelName;
            chatClient.getSubscribedChannels().then(createOrJoinGeneralChannel);
            // when the access token is about to expire, refresh it
            chatClient.on('tokenAboutToExpire', function () {
                refreshToken(username);
            });
            // if the access token already expired, refresh it
            chatClient.on('tokenExpired', function () {
                refreshToken(username);
            });
            // Alert the user they have been assigned a random username
            username = data.identity;
            print('Bylo vám pøidìleno náhodné uživatelské jméno: ' +
                    '<span class="me">' + username + '</span>', true);
        }).catch(error => {
            console.error(error);
            print('There was an error creating the chat client:<br/>' + error, true);
            print('Please check your .env file.', false);
        });
    });
    function refreshToken(identity) {
        console.log('Token about to expire');
        // Make a secure request to your backend to retrieve a refreshed access token.
        // Use an authentication mechanism to prevent token exposure to 3rd parties.
        $.getJSON('/token/' + identity, function (data) {
            console.log('updated token for chat client');
            chatClient.updateToken(data.token);
        });
    }

    function createOrJoinGeneralChannel() {
        // Get the general chat channel, which is where all the messages are
        // sent in this simple application
        //    print('Attempting to join "general" chat channel...');                
        chatClient.getChannelByUniqueName(channelName)
                .then(function (channel) {
                    chatChannel = channel;
                    console.log('Found ' + channelName + ' channel:');
                    console.log(chatChannel);
                    setupChannel();
                }).catch(function () {
            // If it doesn't exist, let's create it
            console.log('Creating ' + channelName + ' channel');
            chatClient.createChannel({
                uniqueName: channelName,
                friendlyName: channelName + ' Chat Channel'
            }).then(function (channel) {
                console.log('Created ' + channelName +' channel:');
                console.log(channel);
                chatChannel = channel;
                setupChannel();
            }).catch(function (channel) {
                console.log('Channel could not be created:');
                console.log(channel);
            });
        });
    }

    // Set up channel after it has been found
    function setupChannel() {
        // Join the general channel
        chatChannel.join().then(function (channel) {
            print('Jste pøipojen do konverzace.');
        });
        // Listen for new messages sent to the channel
        chatChannel.on('messageAdded', function (message) {
            printMessage(message.author, message.body);
        });
    }

    // Send a new message to the general channel
    var $input = $('#chat-input');
    $input.on('keydown', function (e) {

        if (e.keyCode == 13) {
            if (chatChannel === undefined) {
                print('The Chat Service is not configured. Please check your .env file.', false);
                return;
            }
            let chatMsg = $input.val();
            if (chatMsg) {
                chatChannel.sendMessage(chatMsg)
                $input.val('');
            }            
        }
    });
    /* end chat */


    /* video */
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
            roomName = data.videoRoomName ? data.videoRoomName : fallbackRoomName;
            if (roomName) {
                // print("Joining room '" + roomName + "'...");
                print('Vstupujete do videokonference...');
                var connectOptions = {
                    name: roomName,
                    logLevel: 'debug'
                };
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
            print('Opouštíte videokonferenci...');
            activeRoom.disconnect();
        };
    }

    // Successfully connected!
    function roomJoined(room) {
        activeRoom = room;
        print('Jste pøipojen do videokonference jako uživatel: ' +
                '<span class="me">' + identity + '</span>', true);
        //    print("Pøipojen do videokonfernce jako uživatel '" + identity + ".'");
        document.getElementById('button-join').style.display = 'none';
        document.getElementById('button-leave').style.display = 'inline';
        
        document.getElementById('button-mute-audio').style.display = 'inline';
        document.getElementById('button-mute-video').style.display = 'inline';
        // Draw local video, if not already previewing
        var previewContainer = document.getElementById('local-media');
        if (!previewContainer.querySelector('video')) {
            attachParticipantTracks(room.localParticipant, previewContainer);
        }

        room.participants.forEach(function (participant) {
            print('Ve videokonferenci je již pøipojen uživatel: <span class="username">' + participant.identity + "</span>", true);
            var previewContainer = document.getElementById('remote-media');
            attachParticipantTracks(participant, previewContainer);
        });
        // When a participant joins, draw their video on screen
        room.on('participantConnected', function (participant) {
            print('Uživatel <span class="username">' + participant.identity + '</span> se pøipojil do videokonference.', true);
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
            document.getElementById('button-mute-audio').style.display = 'none';
            document.getElementById('button-mute-audio').innerHTML = "Vypnout zvuk";
            document.getElementById('button-mute-video').style.display = 'none';
            document.getElementById('button-mute-video').innerHTML = "Vypnout video";
        });
    }

    //  Local video preview
    document.getElementById('button-preview').onclick = function () {
        var localTracksPromise = previewTracks ?
                Promise.resolve(previewTracks) :
                Twilio.Video.createLocalTracks();
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
    
    
    document.getElementById("button-mute-video").onclick = function() {
        var videoBtn = document.getElementById("button-mute-video");
        if (activeRoom) {
            if (videoBtn.innerHTML === "Vypnout video") {
                activeRoom.localParticipant.videoTracks.forEach(publication => {
                    publication.disable();
                    videoBtn.innerHTML = "Zapnout video";
                });            
            } else {
                activeRoom.localParticipant.videoTracks.forEach(publication => {
                    publication.enable();
                    videoBtn.innerHTML = "Vypnout video";
                });           
            }               
        }
    }
    
    document.getElementById("button-mute-audio").onclick = function() {
        var audioBtn = document.getElementById("button-mute-audio");
        if (activeRoom) {
            if (audioBtn.innerHTML === "Vypnout zvuk") {
                activeRoom.localParticipant.audioTracks.forEach(publication => {
                    publication.disable();
                    audioBtn.innerHTML = "Zapnout zvuk";
                });
            } else {
                activeRoom.localParticipant.audioTracks.forEach(publication => {
                    publication.enable();
                    audioBtn.innerHTML = "Vypnout zvuk";
                });
            }           
        }
    }    
    /* end video */
    
    document.getElementById("button-verify").onclick = function() {
        var opNumber = document.getElementById("op-number").value;
        if (opNumber) {
            print("---------------------");
            print("Èíslo OP: " + opNumber);
            print("Jméno: František Blábol");
            print("Rodné èíslo: 12121980/1111");
            print("Adresa: Randova 3167/7, Smíchov, 150 00 Praha 5");
            print("---------------------");
        } else {
            alert("Zadejte èíslo OP");
        }
        
    }
    
    
//});

