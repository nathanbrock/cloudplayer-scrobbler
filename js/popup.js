/**
 * popup.js
 * Popup page script
 * Copyright (c) 2011 Alexey Savartsov <asavartsov@gmail.com>
 * Licensed under the MIT license
 */
/* Background page */
var bp;

/* Render popup when DOM is ready */
$(document).ready(function() {
    chrome.runtime.getBackgroundPage(function(backgroundPage) {
        bp = backgroundPage;
        if (localStorage.getItem("seen_alert") === null) {
            show_alert();
        }
        set_play_link();
        render_song();
        if (bp.lastfm_api.session.name && bp.lastfm_api.session.key) {
            render_scrobble_link();
        }
        render_auth_link();
        $(".js-dropdown-button").dropdown();
    });
});

function executeOnEnter(event, callback) {
  var key = event.which;
  if(key == 13) { // Enter key
    callback();
  }
}

function set_play_link() {
    $(".js-open-gplay").click(open_play_tab).on('keyup', function(e) { executeOnEnter(e, open_play_tab); });
}

/* Render functions */
function update_song_info() {
    // Match the size attribute of the image URI and replace with 500px.
    var largeAlbumCover = bp.player.song.cover.replace(/=s(\d+)/ig, '=s500');
    
    $("#artist").text(bp.player.song.artist);
    $("#track").text(bp.player.song.title);
    $("#cover").show().attr({ src: largeAlbumCover || "../img/defaultcover.png"});
    $("#album").text(bp.player.song.album);

    if (bp.lastfm_api.session.name && bp.lastfm_api.session.key) {
        render_love_button();
    }
    
    toggle_play_btn();
}

function toggle_play_btn() {
    var play_btn = $(".js-toggle-play > i");

    play_btn.toggle = function() {
        if (bp.player.is_playing) {
            play_btn.removeClass('mdi-av-play-circle-fill');
            play_btn.addClass("mdi-av-pause-circle-fill");
            play_btn.attr('title', 'Pause track');
        } else {
            play_btn.removeClass('mdi-av-pause-circle-fill');
            play_btn.addClass("mdi-av-play-circle-fill");
            play_btn.attr('title', 'Play track');
        }
    }
    // TODO kind of hackish
    // This callback can be called too early (before bp.player is updated)
    // Thus, just try a few times for 3 seconds
    for (var i = 0; i < 30; i++) {
        setTimeout(play_btn.toggle, i * 100);
    }
}

/**
 * Renders current song details
 */
function render_song() {
    if (bp.player.has_song) {
        update_song_info();
        $(".js-toggle-play").on('click', toggle_play).on('keyup', function(e) { executeOnEnter(e, toggle_play); });
        $("#next-btn").on('click', next_song).on('keyup', function(e) { executeOnEnter(e, next_song); });
        $("#prev-btn").on('click', prev_song).on('keyup', function(e) { executeOnEnter(e, prev_song); });
        $('.js-controls').show();
        $('.js-gplay-button').hide();

        if (!(bp.lastfm_api.session.name && bp.lastfm_api.session.key)) {
            $(".js-lastfm-buttons").hide();
        }
    } else {
        $("#artist").text("");
        $("#track").html('Nothing playing...');   
        $(".js-details").hide();
    }
}

/**
 * Renders the link to turn on/off scrobbling
 */
function render_scrobble_link() {
    var $scrobbleLink = $('<a/>', {
      href: "#!",
      html: bp.SETTINGS.scrobble ? "Stop<br/>scrobbling" : "Resume<br/>scrobbling",
      tabindex: 3,
    })
    .click(on_toggle_scrobble)
    .on('keyup', function(e) { executeOnEnter(e, on_toggle_scrobble); });
    
    $('.js-scrobble-link').html($scrobbleLink);
}

/**
 * Renders authentication/profile link
 */
function render_auth_link() {
    if (bp.lastfm_api.session.name && bp.lastfm_api.session.key) {
        render_scrobble_link();

        $('.js-lastfm-authed').show();
        $(".js-btn-connect").hide();
        $('.js-love-button').show();

        $('.js-lastfm-profile')
        .attr('href', "http://last.fm/user/" + bp.lastfm_api.session.name)
        .attr('target', '_blank');

        $('.js-logout').click(on_logout).on('keyup', function(e) { executeOnEnter(e, toggle_play); });

    } else {
      $('.js-love-button').hide();
      $('.js-love-parent').hide();
      $(".js-btn-connect").show().click(on_auth).on('keyup', function(e) { executeOnEnter(e, on_auth); });
    }
}

/**
 * Renders the love button
 */
function render_love_button() {
    $('.js-love-button')
      .removeClass("mdi-action-favorite-outline mdi-action-favorite")
      .addClass("mdi-action-autorenew spin-icon");

    bp.lastfm_api.is_track_loved(bp.player.song.title,
            bp.player.song.artist,
            function(result) {
              if(result) {
                $('.js-love-button')
                  .removeClass("mdi-action-autorenew mdi-action-favorite-outline spin-icon")
                  .addClass("mdi-action-favorite")
                  .on('click', on_unlove)
                  .on('keyup', function(e) { executeOnEnter(e, on_unlove); });
                } else {
                  $('.js-love-button')
                    .removeClass("mdi-action-autorenew mdi-action-favorite spin-icon")
                    .addClass("mdi-action-favorite-outline")
                    .on('click', on_love)
                    .on('keyup', function(e) { executeOnEnter(e, on_unlove); });
                }
                $('.js-love-parent').on('keyup', function(e) { executeOnEnter(e, function() {
                  $('.js-love-button').trigger('click');
                }); });
            });
}

/* Event handlers */

function toggle_play() {
    var has_song = bp.player.has_song;
    find_play_tab(
        function(tab) {
            chrome.tabs.sendMessage(tab.id, {cmd: "tgl"},
                function() {
                    if (has_song) {
                        toggle_play_btn();
                    } else { // if pressing FF on previous song reached end of play queue
                        update_song_info();
                        toggle_play_btn();
                    }
                }
            );
        }
    );
}

function prev_song() {
    find_play_tab(
        function(tab) {
            chrome.tabs.sendMessage(tab.id, {cmd: "prv"},
                update_song_info);
        }
    );
}

function next_song() {
    find_play_tab(
        function(tab) {
            chrome.tabs.sendMessage(tab.id, {cmd: "nxt"},
                update_song_info);
        }
    );
}

/**
 * Turn on/off scrobbling link was clicked
 */
function on_toggle_scrobble() {
    bp.toggle_scrobble();
    render_scrobble_link();
}

/**
 * Authentication link was clicked
 */
function on_auth() {
    bp.start_web_auth();
    window.close();
}

/**
 * Logout link was clicked
 */
function on_logout() {
    bp.clear_session();
    $('.js-lastfm-authed').hide();
    render_auth_link();
}

/**
 * Love button was clicked
 */
function on_love() {
    bp.lastfm_api.love_track(bp.player.song.title, bp.player.song.artist,
        function(result) {
            if (!result.error) {
                render_love_button();
            }
            else {
                if (result.error == 9) {
                    // Session expired
                    bp.clear_session();
                    render_auth_link();
                }

                chrome.browserAction.setIcon({
                     'path': SETTINGS.error_icon });
            }
        });

    $('.js-love-button')
      .removeClass("mdi-action-favorite-outline mdi-action-favorite")
      .addClass("mdi-action-autorenew spin-icon");
}

/**
 * Unlove button was clicked
 */
function on_unlove() {
    bp.lastfm_api.unlove_track(bp.player.song.title, bp.player.song.artist,
        function(result) {
            if (!result.error) {
                render_love_button();
            } else {
                if (result.error == 9) {
                    // Session expired
                    bp.clear_session();
                    render_auth_link();
                }

                chrome.browserAction.setIcon({
                     'path': SETTINGS.error_icon });
            }
        });

    $('.js-love-button')
      .removeClass("mdi-action-favorite-outline mdi-action-favorite")
      .addClass("mdi-action-autorenew spin-icon");
}

/**
* Show temporary msg from me to user <3
*/
function show_alert() {
    $(".js-notifications").removeClass("hidden");
    $(".js-open-extns").click(function() {
        bp.open_extensions_page();
    });
    $(".js-hide-notifications").click(function() {
        $(".js-notifications").addClass("height-hidden");
        localStorage.setItem("seen_alert", "1");
    });
}