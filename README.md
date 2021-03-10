
{
  
  module: "MMM-SonosController",
  header: "SONOS",
  position: "top_right", 
  config:{
    showFavorites: true, //shows favorites, or doesn´t 
    
  }
},  

Sonos Controller is based on the MMM-Sonos Mpdule of tbouron (https://github.com/tbouron/MMM-Sonos). The NodeHelper has been edited a little bit, the MMM-SonosController is completly new. 
The Module adds control functionality to the MagicMirror Module. 

Right now it only works with single Sonos Rooms (I only have a one room setup). 

Only the selection part where you can pick a Playlist/radio stream: 
It´s mainly tested with spotify and german radio streams (tunein). 
Probably i´ll add Amazon playlists soon. 
