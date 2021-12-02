"use strict";



// This is where the world exist!
const w = {};


//@DOC
// ## World Functions
//
// These are functions for creating objects in the game world
//@UNDOC


//@DOC
// Use this to create a new item (as opposed to a room).
// It adds various defaults that apply only to items.
// The first argument should be a string - a unique name for this object, composed only of letters, numbers and underscores.
// It will than take any number of dictionaries that will be combined to set the properties.
// Generally objects should not be created during play as they will not be saved properly.
// Either keep the object hodden until required or clone existing objects.
function createItem() {
  const args = Array.prototype.slice.call(arguments)
  return createItemOrRoom(args, DEFAULT_ITEM, settings.itemCreateFunc)
}



//@DOC
// Use this to create a new room (as opposed to an item).
// It adds various defaults that apply only to items
// The first argument should be a string - a unique name for this object, composed only of letters, numbers and underscores.
// It will than take any number of dictionaries that will be combined to set the properties.
// Generally objects should not be created during play as they will not be saved properly.
// Either keep the object hodden until required or clone existing objects.
function createRoom() {
  const args = Array.prototype.slice.call(arguments)
  const o = createItemOrRoom(args, DEFAULT_ROOM, settings.roomCreateFunc)
  if (o.scenery) {
    for (const x of o.scenery) {
      const el = typeof x === 'string' ? {alias:x} : x 
      const alias = Array.isArray(el.alias) ? el.alias.shift() : el.alias
      const aliases = Array.isArray(el.alias) ? el.alias : []
      if (!alias) throw "ERROR: Scenery item is missing an alias in room: " + o.name
      const obj = createItem(o.name + '_scenery_' + alias.replace(/\W/g, ''), {
        loc:o.name,
        alias:alias,
        synonyms:aliases,
        scenery:true,
        examine:el.examine ? el.examine : lang.default_description,
      })
      delete el.alias
      delete el.examine
      for (const key in el) obj[key] = el[key]
    }
  }
  delete o.scenery
  return o
}


function createItemOrRoom(args, defaults, createFunc) {
  const name = args.shift()
  args.unshift(defaults)
  const o = createObject(name, args)
  if (createFunc) createFunc(o)
  return o
}



//@DOC
// Use this to create new items during play. The given item will be cloned at the given location.
// The `newName` is optional, one will be generated if not supplied. If you do supply one bear inmid that
// every clone must have a unique name.
function cloneObject(item, loc, newName) {
  if (item === undefined) { console.log("Item is not defined.") }
  if (typeof item === 'string') {
    const o = w[item]
    if (o === undefined) { console.log("No item called '" + item + "' found in cloneObject.") }
    item = o
  }
  const clone = {};
  for (let key in item) clone[key] = item[key];
  clone.name = newName === undefined ? util.findUniqueName(item.name) : newName;
  if (!clone.clonePrototype) {
    clone.clonePrototype = item;
  }
  if (loc !== undefined) {
    clone.loc = loc;
  }

  clone.getSaveStringPreamble = function(item) {
    return "Clone:" + this.clonePrototype.name + "="
  }
  
  w[clone.name] = clone
  return clone
}



//@DOC
// Creates a basic object. Generally it is better to use CreateItem or CreateRoom.
function createObject(name, listOfHashes) {
  if (world.isCreated && !settings.saveDisabled) return errormsg("Attempting to use createObject with `" + name + "` after set up. To ensure games save properly you should use cloneObject to create ites during play.")
  if (/\W/.test(name)) return errormsg("Attempting to use the prohibited name `" + name + "`; a name can only include letters and digits - no spaces or accented characters. Use the 'alias' attribute to give an item a name with other characters.")
  if (w[name]) return errormsg("Attempting to use the name `" + name + "` when there is already an item with that name in the world.")
  if (typeof listOfHashes.unshift !== 'function') return errormsg("The list of hashes for `" + name + "` is not what I was expecting. Maybe you meant to use createItem or createRoom?")

  // put the default attributes on the lift
  listOfHashes.unshift(DEFAULT_OBJECT)
  
  const item = { name:name }
  
  for (let hash of listOfHashes) {
    for (let key in hash) {
      item[key] = hash[key]
    }
  }

  // Give every object an alias and list alias (used in the inventories)
  item.setAlias(item.alias ? item.alias : item.name.replace(/_/g, " "), item)

  item.verbFunctions = [function(o, verbList) {
    verbList.push(lang.verbs.examine)
    if (o.use !== undefined) verbList.push(lang.verbs.use)
  }]
  item.nameModifierFunctions = []
  for (let hash of listOfHashes) {
    if (hash.afterCreation) hash.afterCreation(item)
  }

  w[name] = item;
  return item;
}





let player, currentLocation







/*
This can be considered a stateless controller for the game world.
It is stateless because nothing here will be saved - use `game` for that.
It handles initialising, turn taking, room entering
*/
const world = {
  VISIBLE:1,
  REACHABLE:2,

  // constants for lighting levels
  LIGHT_NONE:0,
  LIGHT_SELF:1,
  LIGHT_MEAGRE:2,
  LIGHT_FULL:3,
  LIGHT_EXTREME:4,

  // constants for verbosity of room descriptions
  BRIEF:1,
  TERSE:2,
  VERBOSE:3,
  
  // constants for isAtLoc situations
  LOOK:1,
  PARSER:2,
  INVENTORY:3,
  SIDE_PANE:4,
  PURCHASE:5,
  ALL:6,
  
  // constants for command responses
  // (but a verb will return true or false, so the command that uses it
  // can in turn return one of these - a verb is an attribute of an object)
  SUCCESS:1,                             
  SUCCESS_NO_TURNSCRIPTS:2,
  FAILED:-1,
  PARSER_FAILURE:-2,

  isCreated:false,
  



  
  //------------------------------------------------------------
  // Initialisation

  init:function() {
    // Initialise the player
    for (let key in w) {
      if (w[key].player) { player = w[key]; }
    }
    if (!player) {
      errormsg("No player object found. This is probably due to an error in the data file where the player object is defined, but could be because you have not set one.");
      return;
    }
    game.player = player
    //world.update()


    // Initialise all object
    for (let key in w) {
      world.initItem(w[key]);
    }
    this.isCreated = true;
    
    // Initialise commands
    initCommands();
    
    // Set up the UI
    if (!settings.suppressTitle) msgHeading(settings.title, 2)
    if (settings.subtitle) msgHeading(settings.subtitle, 3)
    io.setTitleAndInit(settings.title)
    if (settings.playMode === 'beta') lang.betaTestIntro()
    settings.verbosity = world.VERBOSE

    game.ticker = setInterval(world.gameTimer, settings.timerInterval);

    w[player.loc].visited++
    world.update()
    world.saveGameState()
  },

  // Every item or room should have this called for them.
  // That will be done at the start, but you need to do it yourself 
  // if creating items on the fly (but you should not be doing that anyway!).
  initItem:function(item) {
    if (settings.playMode === 'dev' && item.loc && !w[item.loc]) {
      console.log("ERROR: The item `" + item.name + "` is in an unknown location (" + item.loc + ")");
    }
    
    if (item._setup) item._setup()
    if (item.setup) item.setup()
    for (let exit of lang.exit_list) {
      const ex = item[exit.name];
      if (ex) {
        ex.origin = item;
        ex.dir = exit.name;
        if (ex.alsoDir) {
          for (let dir of ex.alsoDir) {
            item[dir] = new Exit(ex.name, ex);
            item[dir].scenery = true
            item[dir].isAlsoDir = true
            item[dir].dir = dir
            delete item[dir].alsoDir
          }
        }
      }
    }
    
    if (settings.playMode === 'dev' && item.consultable && !settings.noAskTell) {
      if (!item.tellOptions || item.tellOptions.length === 0) log("WARNING: No tellOptions " + item.name)
      if (!item.askOptions || item.askOptions.length === 0) log("WARNING: No askOptions " + item.name)
    }
    
    if (item.convTopics) {
      item.convTopics.forEach(function (value, i) {
        value.loc = item.name
        createItem(value.name ? value.name : item.name + '_convTopic_' + i, TOPIC(), value)
      })
      delete item.convTopics
    }
    
    if (item.roomSet) {
      if (!settings.roomSetList[item.roomSet]) {
        settings.roomSetList[item.roomSet] = []
      }
      settings.roomSetList[item.roomSet].push({name:item.name, visited:false})
    }

    if (settings.playMode === 'dev') {
      const dirs = lang.exit_list.filter(el => el.type !== 'nocmd').map(el => el.name)
      //console.log(dirs)
      for (let key in item) {
        if (dirs.includes(key)) {
          if (!item[key] instanceof Exit) console.log("ERROR: Exit " + key + " of " + item.name + " is not an Exit instance.")
          if (item[key].name !== '_' && !w[item[key].name]) console.log("ERROR: Exit " + key + " of " + item.name + " goes to an unknown location (" + item[key].name + ").")
        }
        else {
          if (item[key] instanceof Exit) console.log("ERROR: Attribute " + key + " of " + item.name + " is an Exit instance and probably should not.")
        }
      }
    }
  },


  // Start the game - could be called after the start up dialog, so not part of init
  begin:function() {
    if (settings.startingDialogEnabled) return
    if (typeof settings.intro === "string") {
      msg(settings.intro)
    }
    else if (settings.intro) {
      for (let el of settings.intro) msg(el)
    }
    if (typeof settings.setup === "function") settings.setup()
    world.enterRoom()
  },




  //------------------------------------------------------------
  // Turn taking

  // Call after the player takes a turn, sending it a result, SUCCESS, SUCCESS_NO_TURNSCRIPTS or FAILED
  endTurn:function(result) {
    if (result === true) log("That command returned 'true', rather than the proper result code.");
    if (result === false) log("That command returned 'false', rather than the proper result code.");
    util.handleChangeListeners()
    if (result === world.SUCCESS || (settings.failCountsAsTurn && result === world.FAILED)) {
      game.turnCount++
      game.elapsedTime += settings.dateTime.secondsPerTurn;
      for (let key in w) w[key].endTurn()
      util.handleChangeListeners()
      for (const el of settings.afterTurn) el()
      world.resetPauses();
      world.update();
      world.saveGameState();
      endTurnUI(true);
    }
    else {
      endTurnUI(false);
    }
  },


  // Updates the game world, specifically...
  // Sets the scoping snapshot
  // Sets the light/dark
  update:function() {
    if (!player) {
      errormsg("No player object found. This will not go well...");
      return;
    }
    if (!player.loc || !w[player.loc]) {
      errormsg(player.loc === undefined ? "No player location set." : "Player location set to '" + player.loc + "', which does not exist.");
      errormsg("If this is when you load a game: This is likely to be because of an error in one of the .js files. Press F12, and go to the 'Console' tab (if not already open), to see the error. Look at the very first error (but ignore any that mentions 'jquery'). It should tell you the file and line number that is causing the problem.");
      errormsg("If this is when player moves: This is likely to be because of an error in the exit being used.")
    }
    currentLocation = w[player.loc]
    world.scopeSnapshot()

    let light = world.LIGHT_NONE
    for (let key in w) {
      if (w[key].scopeStatus) {
        if (light < w[key].lightSource()) {
          light = w[key].lightSource()
        }
      }
    }
    game.dark = (light < world.LIGHT_MEAGRE)
  },




  resetPauses:function() {
    for (let key in w) {
      if (w[key].paused){
        w[key].paused = false
      }
    }
  },

  // Returns true if bad lighting is not obscuring the item
  ifNotDark:function(item) {
    return (!game.dark || item.lightSource() > world.LIGHT_NONE);
  },

  // scopeStatus is used to track what the player can see and reach; it is a lot faster than working 
  // it out each time, as this needs to be used several times every turn.
  scopeSnapshot:function() {
    // reset every object
    for (let key in w) {
      w[key].scopeStatus = false
      w[key].scopeStatusForRoom = false
    }

    // start from the current room
    let room = w[player.loc];
    if (room === undefined) {
      console.log("Error in scopeSnapshot; the location assigned to the player does not exist ('" + player.loc + "'). Is it possible the location is in a file not loaded? Loaded files are: " + settings.files)
      return errormsg("Error in scopeSnapshot; the location assigned to the player does not exist.")
    }
    if (room === player) {
      return errormsg("Error in scopeSnapshot; the location assigned to the player is the player itself.")
    }

    room.scopeStatusForRoom = world.REACHABLE;
    // crawl up the room hierarchy to the topmost visible
    while (room.loc && room.canReachThrough()) {
      room = w[room.loc];
      room.scopeStatusForRoom = world.REACHABLE;
    }
    // room is now the top level applicable, so now work downwards from here (recursively)
    room.scopeSnapshot(false);
    
    // Also want to go further upwards if room is transparent
    while (room.loc && room.canSeeThrough()) {
      const newRoom = w[room.loc]
      if (room === newRoom) throw "Object with location set to itself: " + room.loc 
      
      room = newRoom
      room.scopeStatusForRoom = world.VISIBLE
    }
    // room is now the top level applicable

    room.scopeSnapshot(true)
  },


  //------------------------------------------------------------
  // Entering a new room

  // Runs the script and gives the description
  enterRoom:function(exit) {
    if (currentLocation.beforeEnter === undefined) {
      return errormsg("This room, " + currentLocation.name + ", has no 'beforeEnter` function defined.  This is probably because it is not actually a room (it was not created with 'createRoom' and has not got the DEFAULT_ROOM template), but is an item. It is not clear what state the game will continue in.")
    }
    settings.beforeEnter(exit)
    if (currentLocation.visited === 0) {
      if (currentLocation.roomSet) {
        currentLocation.roomSetOrder = 1
        for (const el of settings.roomSetList[currentLocation.roomSet]) {
          if (el.visited) currentLocation.roomSetOrder++
          if (el.name === currentLocation.name) el.visited = true
        }
      }
      currentLocation.beforeFirstEnter(exit)
    }
    currentLocation.beforeEnter(exit)
    world.enterRoomAfterScripts(exit);
  },

  // Called when entering a new room, after beforeEnter and beforeFirstEnter re done
  enterRoomAfterScripts:function(exit) {
    currentLocation.description()
    player.handleMovingFollowers(exit) 
    currentLocation.visited++
    currentLocation.afterEnter(exit)
    settings.afterEnter(exit)
    if (currentLocation.visited === 1) { currentLocation.afterFirstEnter(exit) }
    for (let key in currentLocation.afterEnterIf) {
      // if already done, skip
      if (currentLocation.afterEnterIfFlags.split(" ").includes(key)) continue;
      if (currentLocation.afterEnterIf[key].test()) {
        currentLocation.afterEnterIf[key].action()
        currentLocation.afterEnterIfFlags += " " + key
      }
    }
  },
  
  

  //------------------------------------------------------------
  // Real time event handling
  gameTimer:function() {
    // Note that this gets added to window by setInterval, so 'this' does not refer to the game object
    game.elapsedRealTime++;
    let somethingHappened = false
    for (let i = 0; i < game.timerEventNames.length; i++) {
      if (game.timerEventTriggerTimes[i] && game.timerEventTriggerTimes[i] < game.elapsedRealTime) {
        const flag = settings.eventFunctions[game.timerEventNames[i]]()
        if (game.timerEventIntervals[i] !== -1 && !flag) {
          game.timerEventTriggerTimes[i] += game.timerEventIntervals[i]
        }
        else {
          game.timerEventTriggerTimes[i] = 0
        }
        somethingHappened = true
      }
    }
    if (somethingHappened) util.handleChangeListeners()
  },


  //------------------------------------------------------------
  // UNDO Support
  gameState:[],
  saveGameState:function() {
    if (settings.maxUndo > 0) {
      world.gameState.push(saveLoad.getSaveBody());
      if (world.gameState.length > settings.maxUndo) world.gameState.shift();
    }
  },

}





const game = {
  turnCount:0,
  elapsedTime:0,
  elapsedRealTime:0,
  startTime:settings.dateTime.start,
  name:'built-in_game_object',
  
  timerEventNames:[],
  timerEventTriggerTimes:[],
  timerEventIntervals:[],

  getSaveString:function() {
    let s = "GameState="
    for (const key in this) {
      if (!this.saveLoadExclude(key)) s += saveLoad.encode(key, this[key])
    }
    return s
  },
  setLoadString:function(s) {
    const parts = s.split("=")
    if (parts.length !== 2) return errormsg("Bad format in saved data (" + s + ")")
    if (parts[0] !== "GameState") return errormsg("Expected GameState to be second")
    saveLoad.setFromArray(this, parts[1].split(";"));
  },
  saveLoadExclude:function(att) {
    return (att === 'player' || typeof this[att] === 'function' || typeof this[att] === 'object')
  },
}






function Exit(name, hash) {
  if (!hash) hash = {}
  this.name = name
  this.use = util.defaultExitUse
  this.getExitObject = function() { return lang.exit_list.find(el => el.name === this.dir ) }
  this.nice = function() {
    const dirObj = this.getExitObject()
    return dirObj.niceDir ? dirObj.niceDir : dirObj.name
  }
  this.reverseNice = function() {
    const dirObj = this.reverseObject()
    return dirObj.niceDir ? dirObj.niceDir : dirObj.name
  }
  this.reverse = function() { return this.getExitObject().opp }
  this.reverseObject = function() {
    const dir = this.getExitObject().opp
    return lang.exit_list.find(el => el.name === dir)
  }
  this.isLocked = function() { return this.origin.isExitLocked(this.dir); }
  this.setLock = function(locked) { return this.origin.setExitLock(this.dir, locked); }
  this.isHidden = function() { return this.origin.isExitHidden(this.dir) || game.dark; }
  this.setHide = function(hidden) { return this.origin.setExitHide(this.dir, hidden); }
  for (let key in hash) {
    if (key !== 'name') this[key] = hash[key];
  }
}




