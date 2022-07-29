"use strict"

settings.title = "The Mad ERP Supervisor"
settings.author = "Dimitar Dimitrov (@mechachki 🐻)"
settings.version = "0.01"
settings.thanks = ["Michael Tangermann and Jordy Thielen for supporting us."]
settings.warnings = "No warnings have been set for this game."
settings.playMode = "play"

//turn off compass
settings.compassPane = false
settings.statusPane = false
settings.inventoryPane = [] // disable inventory pane while keeping the refresh
settings.go_successful = [] //disable the annoying message that says go to (prev room)

settings.roomCreateFunc = function(o) {
    if (o.dests) {
        for (const ex of o.dests) {
        ex.origin = o
        ex.dir = 'to ' + (o.dirAlias ? o.dirAlias : o.alias)
        }
    }
}