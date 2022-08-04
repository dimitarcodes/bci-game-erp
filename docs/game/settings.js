"use strict"

settings.title = "The Mad ERP Supervisor"
settings.author = "Floris van Wettum and Dimitar Dimitrov (@mechachki 🐻)"
settings.version = "0.06"
settings.thanks = ["Michael Tangermann and Jordy Thielen for supporting us."]
settings.warnings = "No warnings have been set for this game."
settings.playMode = "dev"

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

const walkthroughs = {
    a:[
        "go to first thesis meeting",
        "check markers",
        "check sampling rate",
        "go to preprocessing phase",
        "apply epoching",
        "apply spectral filter",
        "choose band B"
    ],
    b:[
        "go to first thesis meeting",
        "check markers",
        "check sampling rate",
        "go to preprocessing phase",
        "apply epoching",
        "plot data",
        "apply spectral filter",
        "choose band B",
        "plot data",
        "apply downsampling",
        "go to feature engineering phase",
        "apply jumping means",
        "select set a"
        
    ]
}