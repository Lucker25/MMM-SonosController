const NodeHelper = require("node_helper");
//const {AsyncDeviceDiscovery, Listener: listener} = require("../../node_modules/sonos");
//const Sonos = require("../../node_modules/sonos");
//const Helpers = require("../../node_modules/sonos/lib/helpers");
const request = require("request");
const SonosManager = require("./node_modules/@svrooij/sonos").SonosManager
const SonosEvents = require('./node_modules/@svrooij/sonos/lib/models/sonos-events').SonosEvents
//const SonosManager = require("../../node_modules/@svrooij/sonos").SonosManager
//const SonosEvents = require('../../node_modules/@svrooij/sonos/lib/models/sonos-events').SonosEvents
const { XMLParser } = require('../../node_modules/fast-xml-parser')
const parser = require('../../node_modules/fast-xml-parser')

const MUSIC_SERVICES = require('./Db-MusicServices.json')

module.exports = NodeHelper.create({
  discovery: null,
  asyncDevice: null,
  sonos: null,
  library: null,
  zone: "Küche",
  tempCover: null, 
  init: function () {
    let that = this;
    this.manager = new SonosManager()
    this.manager.InitializeWithDiscovery(10)
    .then(() => {
      //that.manager.Devices.forEach(d => console.log('Device %s (%s) is joined in %s', d.Name, d.uuid, d.GroupName))
      that.getLibrary()
      that.manager.Devices.forEach(d => {
        let name = d.name
        console.log('Device %s (%s) is joined in %s', d.Name, d.Uuid, d.GroupName)
        
        d.Events.on(SonosEvents.CurrentTrackMetadata, metadata => {
          //console.log('Current Track metadata for %s', d.Name)
          //if (metadata != undefined)
            if (!metadata.AlbumArtUri) metadata.AlbumArtUri = this.tempCover; 
            this.sendSocketNotification("SET_SONOS_CURRENT_TRACK", {track:metadata});
        })
        d.Events.on(SonosEvents.CurrentTransportState, state => {
          //console.log('New state for %s %s', d.Name, state)
        })
        d.Events.on(SonosEvents.CurrentTransportStateSimple, state => {
          //console.log('New simple state for %s %s', d.Name, state)
          this.sendSocketNotification("SET_SONOS_PLAY_STATE", {
            name,
            state
          });
        })
        d.Events.on(SonosEvents.Volume , volume => {
          //console.log('New volume for %s %s', d.Name, volume)
          this.sendSocketNotification("SET_SONOS_VOLUME", {
            name,
            volume
          });
        })
      })
    })
    .catch(console.error)
  },

  stop: function () {
    /*if (listener.isListening()) {
      listener
        .stopListener()
        .then(() => {
          console.debug("Stopped all listeners to Sonos devices");
        })
        .catch((error) => {
          console.error(
            `Failed to stop listeners to Sonos devices, connections might be dangling: ${error.message}`
          );
        });
    }*/
  },

  socketNotificationReceived: function (id, payload) {
    //let sonos = this.sonos;
    switch (id) {
      case "SONOS_START":
        this.initManager();
        break;
      case "SONOS_TOGGLE_PLAY":
        this.manager.devices[0].TogglePlayback();
        break;
      case "SONOS_NEXT_SONG":
        this.manager.devices[0].Next()
        break;
      case "SONOS_PREVIOUS_SONG":
        this.manager.devices[0].Previous()
        break;
      case "SET_SONOS_VOLUME":
        this.manager.devices[0].SetVolume(payload.volume)
        break;
      case "SET_SONOS_URI":
        if (payload.AlbumArtUri) this.tempCover = payload.AlbumArtUri

        this.play(payload);
        
        break;
      default:
        console.info(`Notification with ID "${id}" unsupported. Ignoring...`);
        break;
    }
  },

  initManager: function (attempts = 0) {
    let that = this;
    that.getLibrary()
    that.manager.Devices[0].GetState().then( d=> {
      //console.log(d);
      //if (d.positionInfo.TrackMetaData != undefined)
        this.sendSocketNotification("SET_SONOS_CURRENT_TRACK", {"track":d.positionInfo.TrackMetaData});
      this.sendSocketNotification("SET_SONOS_VOLUME", {"volume":d.volume});
      this.sendSocketNotification("SET_SONOS_PLAY_STATE", {"state":d.transportState});

    })
  },

  getLibrary(groups) {
    this.manager.devices[0].GetFavorites()
      .then(favList =>{
        this.sendSocketNotification("SET_SONOS_FAVORITES", favList);
      })
  },

  async play(meta) {
    //console.log(meta)
    let device = this.manager.devices[0]
    //this.manager.devices[0].SetAVTransportURI(meta.TrackUri)
      /*this.manager.devices[0].SetAVTransportURI({
        InstanceID: 0, CurrentURI: meta.TrackUri, CurrentURIMetaData: meta
      }).then(
        this.manager.devices[0].Play()
      )*/

      const favorites = await device.ContentDirectoryService.Browse({
        'ObjectID': 'FV:2', 'BrowseFlag': 'BrowseDirectChildren', 'Filter': '*', 'StartingIndex': 0,
        'RequestedCount': 1000, 'SortCriteria': ''
      })
      const favoritesArray = await parseBrowseToArray(favorites, 'item')
      const foundIndex = favoritesArray.findIndex((item) => {
        return (item.title.includes(meta.Title))
      })
      //console.log(favoritesArray[foundIndex])

      const exportData = {
        'uri': favoritesArray[foundIndex].uri,
        'metadata': favoritesArray[foundIndex].metadata,
        'queue': (favoritesArray[foundIndex].processingType === 'queue')
      }
      //console.log(exportData)
      if (exportData.queue) {
        await device.AVTransportService.RemoveAllTracksFromQueue()
        await device.AVTransportService.AddURIToQueue({
          InstanceID: 0, EnqueuedURI: exportData.uri, EnqueuedURIMetaData: exportData.metadata,
          DesiredFirstTrackNumberEnqueued: 0, EnqueueAsNext: true
        })
        await device.SwitchToQueue()
        
      } else {
        await device.AVTransportService.SetAVTransportURI({
          InstanceID: 0, CurrentURI: exportData.uri, CurrentURIMetaData: exportData.metadata
        })
      }
      await device.Play()

  }
});

async function decodeHtmlEntity(htmlData){
  
  if (typeof htmlData !== 'string') {
    throw new Error('htmlData is not string')
  }
  return String(htmlData).replace(/(&lt;|&gt;|&apos;|&quot;|&amp;)/g, substring => {
    switch (substring) {
    case '&lt;': return '<'
    case '&gt;': return '>'
    case '&apos;': return '\''
    case '&quot;': return '"'
    case '&amp;': return '&'
    }
  })
}

function isTruthy (input) {
  
  return !(typeof input === 'undefined' || input === null
    //this avoids NaN, positive, negative Infinite
    || (typeof input === 'number' && !Number.isFinite(input)))
}

function isTruthyStringNotEmpty(input) {
  return !(typeof input === 'undefined' || input === null
    //this avoids NaN, positive, negative Infinite, not empty string
    || (typeof input === 'number' && !Number.isFinite(input))
    || typeof input !== 'string' || input === '')
}

function isTruthyProperty(nestedObj, pathArray){
  if (!Array.isArray(pathArray)) {
    throw new Error('2nd parameter is not array')
  }
  if (pathArray.length === 0) {
    throw new Error('2nd parameter is empty array')
  } 
  const property = pathArray.reduce(
    (obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined),
    nestedObj
  )

  return isTruthy(property)
}

async function getMusicServiceId(uri) {
  let sid = '' // default even if uri undefined.
  if (isTruthyStringNotEmpty(uri)) {
    const decodedUri = await decodeHtmlEntity(uri)
    const positionStart = decodedUri.indexOf('?sid=') + '$sid='.length
    const positionEnd = decodedUri.indexOf('&flags=')
    if (positionStart > 1 && positionEnd > positionStart) {
      sid = decodedUri.substring(positionStart, positionEnd)
    }
  }
  return sid
}

async function getMusicServiceName(sid){
  let serviceName = '' // default even if sid is blank
  if (sid !== '') {
    const list = MUSIC_SERVICES
    const index = list.findIndex((service) => (service.sid === sid))
    if (index >= 0) {
      serviceName = list[index].name
    }  
  } 
  return serviceName
}

async function parseBrowseToArray(browseOutcome, itemName){
  if (!isTruthy(browseOutcome)) {
    throw new Error('parameter browse input is missing')
  }
  if (!isTruthyStringNotEmpty(itemName)) {
    throw new Error('parameter item name such as container is missing')
  }
  if (browseOutcome.NumberReturned < 1) {
    return [] // no My Sonos favorites
  }

  const decodedResult = await decodeHtmlEntity(browseOutcome['Result'])
  // stopNodes because we use that value for export and import and no further processing
  const browseJson = await parser.parse(decodedResult, {
    'arrayMode': false, // watch fields of type array!
    'ignoreAttributes': false,
    'attributeNamePrefix': '_', 
    'stopNodes': ['r:resMD'], // for My-Sonos items, play export!
    'parseNodeValue': false, // is default - example Title 49 will otherwise be converted
    'parseAttributeValue': false,  // is default
    'textNodeName': '#text'  //is default, just to remember
  })  
  if (!isTruthyProperty(browseJson, ['DIDL-Lite'])) {
    throw new Error(`${PACKAGE_PREFIX} invalid response Browse: missing DIDL-Lite`)
  }

  // The following section is because of fast-xml-parser with 'arrayMode' = false
  // if only ONE item then convert it to array with one 
  let itemsAlwaysArray = []
  const path = ['DIDL-Lite', itemName]
  if (isTruthyProperty(browseJson, path)) {
    const itemsOrOne = browseJson[path[0]][path[1]]
    if (Array.isArray(itemsOrOne)) { 
      itemsAlwaysArray = itemsOrOne.slice()
    } else { // single item  - convert to array
      itemsAlwaysArray = [itemsOrOne]
    }
  }

  // transform properties
  const transformedItems = await Promise.all(itemsAlwaysArray.map(async (item) => {
    const newItem = {
      'id': '', // required
      'title': '', // required
      'artist': '',
      'album': '',
      'description': '',
      'uri': '',
      'artUri': '',
      'metadata': '',
      'sid': '',
      'serviceName': '',
      'upnpClass': '', // might be overwritten
      'processingType': 'queue' // has to be updated in calling program
    }

    // String() not necessary, see parsing options. But used in case 
    // there might be a number.
    // special property, required. 
    if (!isTruthyProperty(item, ['_id'])) {
      throw new Error(`${PACKAGE_PREFIX} id is missing`) // should never happen
    }
    newItem.id = String(item['_id'])
    if (!isTruthyProperty(item, ['dc:title'])) {
      throw new Error(`${PACKAGE_PREFIX} title is missing`) // should never happen
    }
    newItem.title = await decodeHtmlEntity(String(item['dc:title']))

    // properties, optional
    if (isTruthyProperty(item, ['dc:creator'])) {
      newItem.artist = await decodeHtmlEntity(String(item['dc:creator']))
    }

    if (isTruthyProperty(item, ['upnp:album'])) {
      newItem.album = await decodeHtmlEntity(String(item['upnp:album']))
    }

    if (isTruthyProperty(item, ['res', '#text'])) {
      newItem.uri = item['res']['#text'] // HTML entity encoded, URI encoded
      newItem.sid = await getMusicServiceId(newItem.uri)
      newItem.serviceName = getMusicServiceName(newItem.sid)
    }
    if (isTruthyProperty(item, ['r:description'])) { // my sonos
      newItem.description = item['r:description'] 
    } 
    if (isTruthyProperty(item, ['upnp:class'])) {
      newItem.upnpClass = item['upnp:class']
    }
    // artURI (cover) maybe an array (one for each track) then choose first
    let artUri = ''
    if (isTruthyProperty(item, ['upnp:albumArtURI'])) {
      artUri = item['upnp:albumArtURI']
      if (Array.isArray(artUri)) {
        if (artUri.length > 0) {
          newItem.artUri = artUri[0]
        }
      } else {
        newItem.artUri = artUri
      }
    }
    // special case My Sonos favorites. It include metadata in DIDL-lite format.
    // these metadata include the original title, original upnp:class (processingType)
    if (isTruthyProperty(item, ['r:resMD'])) {
      newItem.metadata = item['r:resMD']
    }
    return newItem
  })
  )
  return transformedItems  // properties see transformedItems definition
}