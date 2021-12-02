"use strict";

// Should all be language neutral


/*

The game state is saved as a name-value pair.

The value is the game state, with each segment separated by an exclamation mark. The first four segments are the header, the rest are the body. The header consists of the title, version, comment and timestamp. Each segment of the body is an object in the game.

An object is saved as its name followed by an equals sign followed by either "Object" or by "Clone:" and the name of the clone's prototype, followed by an equals sign, and then the data. Each datam is separated by a semi-colon. Each datum consists of the name, the type and the value, separated by colons.

If a datum is an object, and has a name attribute, the name is saved as type qobject.

If the datam is an array and the first element is a string, it is assumed that all the elements are strings, and it is saved as an array. Other arrays are not saved.

If the datam is a number, a string or true it is saved as such.

Any other objects or values will not be saved.


*/


const saveLoad = {

  getName:function(filename) {
    return "QJS:" + settings.title + ":" + filename
  },

  saveGame:function(filename, overwrite) {
    if (filename === undefined) {
      errormsg(sl_no_filename);
      return false;
    }
    
    if (localStorage.getItem(this.getName(filename)) && !overwrite) {
      metamsg(lang.sl_already_exists)
      return
    }
    const comment = settings.saveComment ? settings.saveComment() : "-"
    const s = saveLoad.saveTheWorld(comment);
    //console.log(s)
    localStorage.setItem(this.getName(filename), s);
    metamsg(lang.sl_saved, {filename:filename});
    if (settings.afterSave) settings.afterSave(filename)
    return true;
  },

  saveTheWorld:function(comment) {
    return saveLoad.getSaveHeader(comment) + saveLoad.getSaveBody();
  },

  getHeader:function(s) {
    const arr = s.split("!");
    return { title:saveLoad.decodeString(arr[0]), version:saveLoad.decodeString(arr[1]), comment:saveLoad.decodeString(arr[2]), timestamp:arr[3] };
  },

  getSaveHeader:function(comment) {
    const currentdate = new Date();
    let s = saveLoad.encodeString(settings.title) + "!";
    s += saveLoad.encodeString(settings.version) + "!";
    s += saveLoad.encodeString(comment) + "!";
    s += currentdate.toLocaleString() + "!";
    return s;
  },

  getSaveBody:function() {
    const l = [tp.getSaveString(), game.getSaveString(), util.getChangeListenersSaveString()]
    for (let key in w) {
      l.push(key + "=" + w[key].getSaveString())
    }
    return l.join("!")
  },
  

  
  
  
  // LOAD
  
  loadGame:function(filename) {
    log(">" + filename + "<")
    const s = localStorage.getItem(this.getName(filename));
    if (s != null) {
      saveLoad.loadTheWorld(s, 4)
      clearScreen()
      metamsg("Loaded file \"" + filename + "\"")
      if (settings.afterLoad) settings.afterLoad(filename)
      currentLocation.description()
    }
    else {
      metamsg(lang.sl_file_not_found);
    }
  },



  loadTheWorld:function(s, removeHeader) {
    const arr = s.split("!");
    if (removeHeader !== undefined) {
      arr.splice(0, removeHeader);
    }
    
    // Eliminate all clones
    for (let key in w) {
      if (w[key].clonePrototype) delete w[key]
    }
    
    tp.setLoadString(arr.shift())
    game.setLoadString(arr.shift())
    util.setChangeListenersLoadString(arr.shift())
    for (let el of arr) {
      this.setLoadString(el);
    }
    world.update()
    endTurnUI(true)
  },



  setLoadString:function(s) {
    const parts = s.split("=");
    if (parts.length !== 3) {
      errormsg("Bad format in saved data (" + s + ")");
      return;
    }
    const name = parts[0];
    const saveType = parts[1]
    const arr = parts[2].split(";");
    
    if (saveType.startsWith("Clone")) {
      const clonePrototype = saveType.split(":")[1];
      if (!w[clonePrototype]) {
        errormsg("Cannot find prototype '" + clonePrototype + "'");
        return;
      }
      const obj = cloneObject(w[clonePrototype]);
      this.setFromArray(obj, arr);
      w[obj.name] = obj;
      obj.afterLoadForTemplate();
      return
    }
    
    if (saveType === "Object") {
      if (!w[name]) {
        errormsg("Cannot find object '" + name + "'");
        return;
      }
      const obj = w[name];
      this.setFromArray(obj, arr);
      obj.afterLoadForTemplate();
      return
    }
    
    errormsg("Unknown save type for object '" + name + "' (" + hash.saveType + ")");
  },
  
  

  
  
  // UTILs  
  
  decode:function(hash, str) {
    if (str.length === 0) return false
    const parts = str.split(":")
    const key = parts[0]
    const attType = parts[1]
    const s = parts[2]
    
    if (attType === "boolean") {
      hash[key] = (s === "true")
    }

    else if (attType === "number") {
      hash[key] = parseFloat(s)
    }
    
    else if (attType === "string") {
      hash[key] = saveLoad.decodeString(s)
    }
    
    else if (attType === "array") {
      hash[key] = saveLoad.decodeArray(s)
    }
    
    else if (attType === "numberarray") {
      hash[key] = saveLoad.decodeNumberArray(s)
    }
    
    else if (attType === "emptyarray") {
      hash[key] = []
    }
    
    else if (attType === "emptystring") {
      hash[key] = ''
    }
    
    else if (attType === "qobject") {
      // this will cause an issue if it points to a clone that has not been done yet !!!
      hash[key] = w[s]
    }
    
    return key
  },
  
  encode:function(key, value) {
    if (value === 0) return key + ":number:0;"
    if (value === false) return key + ":boolean:false;"
    if (value === '') return key + ":emptystring;"
    if (!value) return ''
    let attType = typeof value;
    if (Array.isArray(value)) {
      try {
        if (value.length === 0) return key + ":emptyarray;";
        if (typeof value[0] === 'string') return key + ":array:" + saveLoad.encodeArray(value) + ";";
        if (typeof value[0] === 'number') return key + ":numberarray:" + saveLoad.encodeNumberArray(value) + ";";
        return '';
      } catch (error) {
        // Add the name of the attribute to the error message
        console.trace()
        log(value)
        throw "Error encountered with attribute \"" + key + "\": " + error + ". More here: https://github.com/ThePix/QuestJS/wiki/Save-Load#save-errors"
      }
    }
    if (value instanceof Exit) {
      return '';
    }
    if (attType === "object") {
      if (value.name) return key + ":qobject:" + value.name + ";";
      return '';
    }
    if (attType === "string") {
      return key + ":string:" + saveLoad.encodeString(value) + ";";
    }
    return key + ":" + attType + ":" + value + ";";
  },


  replacements:[
    { unescaped:':', escaped:'cln'},
    { unescaped:';', escaped:'scln'},
    { unescaped:'!', escaped:'exm'},
    { unescaped:'=', escaped:'eqs'},
    { unescaped:'~', escaped:'tld'},
  ],


  encodeString:function(s) {
    for (let d of saveLoad.replacements) {
      if (typeof s !== 'string') throw "Found type \"" + (typeof s) + "\" in array - should be only strings."
      s = s.replace(new RegExp(d.unescaped, "g"), "@@@" + d.escaped + "@@@");
    }
    return s;
  },

  decodeString:function(s) {
    //if (typeof s !== 'string') {
    //  console.log("Expecting a string there, but found this instead (did you add an object to a list rather than its name?):")
    //  console.log(s)
    ///}
    for (let d of saveLoad.replacements) {
      s = s.replace(new RegExp("@@@" + d.escaped + "@@@", "g"), d.unescaped);
    }
    return s;
  },

  encodeArray:function(ary) {
    return ary.map(el => saveLoad.encodeString(el)).join('~');
  },

  decodeArray:function(s) {
    return s.split('~').map(el => saveLoad.decodeString(el));
  },

  encodeNumberArray:function(ary) {
    return ary.map(el => {
      if (typeof el !== 'number') throw "Found type \"" + (typeof el) + "\" in array - should be only numbers."
      return el.toString()
    }).join('~');
  },

  decodeNumberArray:function(s) {
    return s.split('~').map(el => parseFloat(el));
  },

  decodeExit:function(s) {
    return s.split('~').map(el => saveLoad.decodeString(el));
  },

  
  lsTest:function() {
    const test = 'test';
    try {
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        return false;
    }
  },

  
  
  
  // Other functions
  
  deleteGame:function(filename) {
    localStorage.removeItem(this.getName(filename));
    metamsg(lang.sl_deleted);
  },

  dirGame:function() {
    const arr0 = lang.sl_dir_headings.map(el => '<th>' + el + '</th>')
    if (!settings.saveComment) arr0.pop()
    let s = arr0.join('')
    for (let key in localStorage) {
      if (!key.startsWith('QJS:')) continue
      const arr1 = key.split(':')
      const arr2 = localStorage[key].split('!')
      log(arr2.slice(1, 4))
      s += "<tr>"
      s += "<td>" + arr1[2] + "</td>"
      s += "<td>" + arr1[1] + "</td>"
      s += "<td>" + arr2[1] + "</td>"
      s += "<td>" + arr2[3] + "</td>"
      if (settings.saveComment) s += "<td>" + arr2[2] + "</td>"
      s += "</tr>"
    }  
    _msg(s, {}, {cssClass:"meta", tag:'table'})
    metamsg(lang.sl_dir_msg)
  },
    
  testExistsGame:function(filename) {
    const data = localStorage[this.getName(filename)]
    return data !== undefined
  },
  
  getSummary:function(filename) {
    const data = localStorage[this.getName(filename)]
    if (!data) return null
    const arr = data.split('!')
    return arr.slice(1, 4)
  },

  setFromArray:function(obj, arr) {
    const keys = obj.saveLoadExclude ? Object.keys(obj).filter(e => !obj.saveLoadExclude(e)) : Object.keys(obj)
    for (let el of keys) delete obj[el]
    for (let el of arr) saveLoad.decode(obj, el)
  },



  // ------------------------------------------------------------------------------------------
  //    TRANSCRIPTS
  //
  // Here because it uses localStorage. That said, there are two independant systems, the second
  // records commands to create a walk-through, and is saved in an array, this.transcriptWalkthrough
  // because only the author should ever use it. 

  transcript:false,  // Set to true when recording
  transcriptName:"QJST:" + settings.title + ":transcript",

  transcriptStart:function() {
    this.transcript = true
    this.transcriptWalkthrough = []
    metamsg(lang.transcript_on)
    this.transcriptWrite(lang.transcriptStart())
  },

  transcriptEnd:function() {
    this.transcriptWrite(lang.transcriptEnd())
    this.transcript = false
    metamsg(lang.transcript_off)
  },

  transcriptAppend:function(data) {
    if (!this.transcript) return
    
    //     {cmd:"speak to The guy", menu:0},
    if (data.cssClass === 'menu') {
      log('here')
      let previous = this.transcriptWalkthrough.pop()
      log(previous)
      if (previous) {
        previous = previous.replace(/\,$/, '').trim()
      log(previous)
        this.transcriptWalkthrough.push('    {cmd:' + previous + ', menu:' + data.n + '},')
      }
    }
    
    this.transcriptWrite('<p class="' + data.cssClass + '">' + data.text + '</p>')
  },

  // Used internally to write to the file, appending it to the existing text.
  transcriptWrite:function(html) {
    let s = localStorage.getItem(this.transcriptName)
    if (!s) s = ''
    s += '\n\n' + html
    localStorage.setItem(this.transcriptName, s)
  },

  transcriptClear:function(data) {
    localStorage.removeItem(this.transcriptName)
    metamsg(lang.transcript_cleared)
  },

  // Is there a transcript saved?
  transcriptExists:function(data) {
    return localStorage.getItem(this.transcriptName) !== undefined
  },

  transcriptShow:function() {
    const s = localStorage.getItem(this.transcriptName)
    if (!s) {
      metamsg(lang.transcript_none)
      return false
    }
    
    let html = ''
    html += '<div id="main"><div id="inner"><div id="output">'
    html += lang.transcriptTitle()
    html += s
    html += '</div></div></div>'
    io.showInTab(html, 'QuestJS Transcript: ' + settings.title)
    metamsg(lang.done_msg)
  },

  transcriptWalk:function() {
    let html = ''
    html += '<div id="main"><div id="inner"><div id="output">'
    html += '<br/><h2>Generated QuestJS Walk-through</h2><br/><br/>'
    html += '<p>Copy-and-paste the code below into code.js. You can quickly run the walk-though with [Ctrl][Enter].</p>'
    html += '<p>If you already have a walk-through, you will need to just copy-and-paste the right bit - probably all but the first and last lines, and insert just before the curly brace at the end. You may need to rename it too.</p>'
    html += '<pre>\n\n\nconst walkthroughs = {\n  c:[\n'
    html += this.transcriptWalkthrough.join('\n')
    html += '\n  ],\n}</pre>'
    html += '</div></div></div>'
    io.showInTab(html, 'QuestJS Transcript: ' + settings.title)
  },
}
