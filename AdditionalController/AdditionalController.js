/* Magic Mirror
 * Module: MyFirstTimerModule
 *
 * By Nico Arbter
 * MIT Licensed.
 * To-Dos:
 * jshint esversion: 6
 */

Module.register("AdditionalController", {
  // Default module config.
  defaults: {
    showFavorites: true, 
    hostController: "MMM-SonosController"
  },

  // Define styles.
  getStyles: function () {
    return ["AdditionalController.css"];
  },
  // Override dom generator.
  getDom: function () {
    let that = this;
    var wrapper = document.createElement("div");
    wrapper.className = "sonosModuleDiv";
    wrapper.id = "SonosControllerWrapper";

    var controlDiv = document.createElement("div");
    controlDiv.className = "controlDiv";
    controlDiv.id = "controlDiv";

    document.addEventListener("keydown", function (event) {
      if (event.key == "MediaPlayPause") {
        that.sendNotification("SONOS_TOGGLE_PLAY", "");
      } else if (event.key == "MediaTrackNext") {
        that.sendNotification("SONOS_NEXT_SONG", "");
      } else if (event.key == "MediaTrackPrevious") {
        that.sendNotification("SONOS_PREVIOUS_SONG", "");
      }
    }); // added media buttons just for fun

    let infoDiv = document.createElement("div");
    infoDiv.id = "infoDiv";
    infoDiv.className = "infoDiv";
    //adding the cover
    let cover = document.createElement("img");
    cover.id = "cover";
    cover.className = "cover";

    infoDiv.appendChild(cover);

    let titleDiv = document.createElement("div");
    titleDiv.id = "titleDiv";
    titleDiv.className = "titleDiv";
    //adding the artist
    let artist = document.createElement("span");
    artist.className = "title";
    artist.id = "artist";
    artist.innerHTML = "Artist";
    titleDiv.appendChild(artist);
    // adding the title
    let title = document.createElement("span");
    title.className = "title";
    title.id = "title";
    title.innerHTML = "Here is the title";
    titleDiv.appendChild(title);

    infoDiv.appendChild(titleDiv);

    controlDiv.appendChild(infoDiv);
    let buttonDiv = document.createElement("div");
    buttonDiv.id = "buttonDiv";
    buttonDiv.className = "buttonDiv";
    //adding the backbutton
    var backButton = document.createElement("button");
    backButton.id = "backButton";
    backButton.className = "backButton btnClass";

    backButton.addEventListener("click", function (e) {
      console.log("click back");
      that.sendNotification("SONOS_PREVIOUS_SONG", "");
    });
    var image = document.createElement("i");
    backButton.innerHTML = "";
    image.className = "fas fa-backward";
    backButton.appendChild(image);
    buttonDiv.appendChild(backButton);

    // adding the play/pause button
    var playButton = document.createElement("button");
    playButton.id = "playButton";
    playButton.className = "playButton btnClass";

    playButton.addEventListener("click", function (e) {
      console.log("click play");
      that.sendNotification("SONOS_TOGGLE_PLAY", "");
    });
    var image = document.createElement("i");
    playButton.innerHTML = "";
    image.className = "fas fa-play";
    playButton.appendChild(image);
    buttonDiv.appendChild(playButton);

    //adding the nextbutton
    var nextButton = document.createElement("button");
    nextButton.id = "nextButton";
    nextButton.className = "nextButton btnClass";

    nextButton.addEventListener("click", function (e) {
      console.log("click next");
      that.sendNotification("SONOS_NEXT_SONG", "");
    });
    var image = document.createElement("i");
    nextButton.innerHTML = "";
    image.className = "fas fa-forward";
    nextButton.appendChild(image);
    buttonDiv.appendChild(nextButton);

    controlDiv.appendChild(buttonDiv);

    let volumeSliderContainer = document.createElement("div");
    volumeSliderContainer.className = "sliderDiv";
    let volumeSlider = document.createElement("input");
    {
      volumeSlider.type = "range";
      volumeSlider.min = "1";
      volumeSlider.max = "100";
      volumeSlider.className = "volumeSlider slider";
      volumeSlider.id = "volumeSlider";
      volumeSlider.on;

      volumeSlider.oninput = function () {
        volumeSlider.classList.add("active");
        // Timeout for not resetting the volume to an old value and wait until the input has ended, else problems on rpi
        if (volumeSlider.delay) {
          clearTimeout(volumeSlider.delay);
        }
        volumeSlider.delay = setTimeout(() => {
          that.sendNotification("SET_SONOS_VOLUME", {
            volume: this.value
          });
          clearTimeout(volumeSlider.delay);
          volumeSlider.delay = undefined;
          volumeSlider.classList.remove("active");
        }, 300);
      };
    }
    volumeSliderContainer.appendChild(volumeSlider);
    controlDiv.appendChild(volumeSliderContainer);

    wrapper.appendChild(controlDiv);
    console.log("wrapper", wrapper);
    this.wrapper = wrapper; 
    return wrapper;
  },
  start: function () {
    let that = this;
    Log.info("Starting module: " + this.name, this);
    
  },
  tempAlbum: "",
  sonos: {
    zone: ""
  },
  notificationReceived: function (notification, payload, sender) {
    let that = this; 
    if (sender == undefined) return;
    if(sender.name != this.config.hostController) return;
    //    if (this.config.zoneName != payload.group.Name) might want to implement different zones
    switch (notification) {
      case "SET_SONOS_CURRENT_TRACK":
        this.wrapper.querySelector("#title").innerHTML = payload.track.Title.length > 50 ? "loading" : payload.track.Title;
        console.warn("tempAlbum", that.tempAlbum)
        if (payload.track.AlbumArtUri != null) {
          this.wrapper.querySelector("#cover").style.display = "block";
          this.wrapper.querySelector("#cover").src = payload.track.AlbumArtUri;
          this.wrapper.querySelector("#titleDiv").classList.remove("noCover");
        } 
        else if (that.tempAlbum != ""){
          this.wrapper.querySelector("#cover").style.display = "block";
          this.wrapper.querySelector("#cover").src = that.tempAlbum;
          this.wrapper.querySelector("#titleDiv").classList.remove("noCover");
        }
        else {
          this.wrapper.querySelector("#cover").style.display = "none";
          this.wrapper.querySelector("#titleDiv").classList.add("noCover");
        }

        if (!payload.track.Duration) {
          this.wrapper.querySelector("#backButton").style.display = "none";
          this.wrapper.querySelector("#nextButton").style.display = "none";
        } else {
          this.wrapper.querySelector("#backButton").style.display = "";
          this.wrapper.querySelector("#nextButton").style.display = "";
        }
        if (payload.track.Artist) this.wrapper.querySelector("#artist").innerHTML = payload.track.Artist.indexOf("BUFFERING") > -1 ? "loading": payload.track.Artist;
        else this.wrapper.querySelector("#artist").innerHTML  = ""
        break;
      case "SET_SONOS_PLAY_STATE":
        this.setState(payload.state);
        break;
      case "SET_SONOS_VOLUME":
        let volumeSlider = this.wrapper.querySelector("#volumeSlider");
        if (volumeSlider.dragged == true) return;
        console.log("setvolume", payload.volume);
        this.wrapper.querySelector("#volumeSlider").value = payload.volume;
        break;
      case "SET_SONOS_FAVORITES":
        this.createList(payload.Result);
        break;
      default:
        break;
    }
  },
  favListDiv: null,
  createList: function (items) {
    let that = this;
    if (this.favListDiv == null) {
      this.favListDiv = document.createElement("div");
      this.favListDiv.className = "favoritesListDiv";
    } else {
      while (this.favListDiv.firstChild) {
        this.favListDiv.removeChild(this.favListDiv.lastChild);
      }
    }
    if (!this.config.showFavorites)  this.favListDiv.style.display = "none"; 
    items.sort((a, b) => a.Title > b.Title);
    items.map((item) => {
      console.log(item);
      let span = document.createElement("span");
      span.innerHTML = item.Title;
      span.className = "favoriteListElement";
      span.addEventListener("click", function (e) {
        that.tempAlbum = item.AlbumArtUri;
        that.sendNotification("SET_SONOS_URI", item);
      });
      this.favListDiv.appendChild(span);
    });

    this.wrapper.appendChild(this.favListDiv);
    this.wrapper.classList.add("withFav");
  },
  setState: function (state) {
    let playButton = this.wrapper.querySelector("#playButton");

    var image = document.createElement("i");
    playButton.innerHTML = "";

    if (state == "PLAYING") {
      image.className = "fas fa-pause";
    } else if (state == "PAUSED" || state == "STOPPED") {
      image.className = "fas fa-play";
    } else {
      image.className = "fas fa-hourglass-start";
    }
    playButton.appendChild(image);
  }
});
