
var ext = (function(proto) {

	var ext = arguments.callee;

	for (var obj in proto)
		ext[obj] = proto[obj];
	
	ext._cstr();
	return ext;

})({

separator: ":",
trimPrefix: [],

i18n: ["welcome", "locale", "url", "bookmarksManagerName", "bookmarksBarName", "googleBookmarksFolderName"],
welcome: "welcome",
bookmarksManagerName: "bookmarkManagerName",
bookmarksBarName: "bookmarksBarName",
googleBookmarksFolderName: "googleBookmarksFolderName",
locale: "@@ui_locale",

bookmarksPath: ["xml_api_reply", "bookmarks", "bookmark"],
data: null,
syncCallbacks: 0,
resync: false,
reloadNeeded: true,
nextSync: null,
syncIntervalMs: 60000,
firstRun: false,
lastBookmarksBarId: undefined,
foundBookmarksFolder: 0,
lastSyncBookmarks: 0,
url: "url",
rootFolders: [],
lastVer: localStorage["lastVer"],

_cstr: function() {

	for (var i = 0; i < this.i18n.length; i++) {
		this[this.i18n[i]] = chrome.i18n.getMessage(this[this.i18n[i]]);
		console.log(this.i18n[i] + ": " + this.s(this[this.i18n[i]]));
	}

	console.log("Bookmarks Manager: " + this.s(this.bookmarksManagerName));

	this.trimPrefix.push(this.bookmarksBarName);
	this.trimPrefix.push(this.googleBookmarksFolderName);

	console.log("Target: " + this.s(this.trimPrefix.join("/")));

	if (!this.doFirstRun())
		this.sync();
},

doFirstRun: function() {
	var thisVer = chrome.app.getDetails().version;
	console.log("lastVer: " + this.s(this.lastVer));
	console.log("thisVer: " + this.s(thisVer));
	if (thisVer == this.lastVer)
		return false;
	localStorage["lastVer"] = thisVer;

	console.log("Running the first time.");
	this.firstRun = true;
	this.sync();
	return true;
},

bind: function(func) {
	var self = this;
	return function() {
		return (func? func: function(){}).apply(self, arguments);
	};
},

bindSync: function(func) {
	this.syncCallbacks++;
	return this.bind(function() {
		var ret = (func? func: function(){}).apply(this, arguments);
		if (--this.syncCallbacks == 0) {
			this.finishedSync();
		}
		return ret;
	});
},

finishedSync: function() {
	this.data = null;
	console.log("finished:" + (this.firstRun? " first": "") + " sync" + (this.resync? ". resyncing": ""));
	if (this.resync)
		return this.sync();
		
	if (!this.firstRun || this.doneFirstRun())
		this.setNextSync();
},

doneFirstRun: function() {

	console.log("doneFirstRun()");

	if (this.lastSyncBookmarks >= 0)
		// successfully got data from google

		if (this.foundBookmarksFolder == this.trimPrefix.length) {
			// everything is ok. show welcome message

			if (this.lastSyncBookmarks == 0) {
				if (confirm(chrome.i18n.getMessage("firstRunSyncedNoBookmarks", [this.welcome])))
					chrome.tabs.create({
						url: this.url
					});
			} else
				alert(chrome.i18n.getMessage("firstRunSyncedBookmarks", [
					this.lastVer? chrome.i18n.getMessage("thankYouForUpgrading", [chrome.app.getDetails().version]): this.welcome, this.lastSyncBookmarks]));
			this.firstRun = false;
			return true;
		} else if (this.lastBookmarksBarId == undefined) {
			// can't find root
			for (var i = 0; i < this.rootFolders.length; i++)
				this.rootFolders[i] = this.s(this.rootFolders[i]);
			var msg = chrome.i18n.getMessage("rootFolderNotFound", [this.bookmarksManagerName, this.s(this.bookmarksBarName), this.s(this.locale), this.rootFolders.join(", ")]);
			console.log(msg);
			alert(msg);
			return true;
		} else
			return !this.promptCreateFolder();
	
	alert(chrome.i18n.getMessage("syncFailed"));
	return true;
},

promptCreateFolder: function() {
	if (!confirm(chrome.i18n.getMessage("createQuestion", [
			this.bookmarksManagerName, this.bookmarksBarName, this.googleBookmarksFolderName])))
		return false;

	console.log("create folder start, base ID: " + this.lastBookmarksBarId);
	chrome.bookmarks.create({
		parentId: this.lastBookmarksBarId,
		title: this.googleBookmarksFolderName
	}, this.bind(function() {
		this.sync();
	}));
	
	return true;
},

setNextSync: function() {
	var o = this.nextSync = {};
	if (this.syncIntervalMs > 0) {
		setTimeout(this.bind(function() {
			console.log("timer fired.");
			if (this.nextSync == o)
				this.sync();
		}), this.syncIntervalMs);
		console.log("timer scheduled.");
	}
},

reload: function() {
	this.reloadNeeded = false;
	console.log("reloaded");
},

sync: function() {
	if (this.reloadNeeded)
		this.reload();
	console.log("starting: sync");
	if (this.data)
		return this.resync = true;
	this.resync = false;

	this.lastSyncBookmarks = -1;
	this.foundBookmarksFolder = 0;

	this.data = $.ajax(this.url,
		{
			cache: false,
			context: this,
			dataType: "xml",
			error: this.bind(function(jqXHR, textStatus, errorThrown) {
				console.log(textStatus + errorThrown);
				// we treat error as fail to get any bookmark
				this.data = this.getDefaultData();
				console.log("using " + this.s(this.data));
				chrome.bookmarks.getTree(this.bindSync(this.onGotChromeTreeForSync));
			}),
			success: this.onReceivedAllFromGoogle
		});
},

onReceivedAllFromGoogle: function(data, textStatus, jqXHR) {
	this.data = this.parseGoogleXml( this.data = $(data) );
	chrome.bookmarks.getTree(this.bindSync(this.onGotChromeTreeForSync));
},

getDefaultData: function() {
	return {bookmarks: {}, labels: {}, parent: null, title: "", path: ""};
},

parseGoogleXml: function() {
	var i, o = this.getDefaultData();
	for (i = 0; i < this.bookmarksPath.length; i++) 
		if (!(this.data = this.data.children(this.bookmarksPath[i])).length)
			return o;

	this.data.each(this.bind(function(idx, ele) {
		this.parseBookmark(o, $(ele));
	}));

	return o;
},

parseBookmark: function(o, ele) {
	var bm = {
		title: ele.children("title").text(),
		url: ele.children("url").text(),
		labels: []
	};
	ele.children("labels").children("label").each(this.bind(function(i, e) {
		bm.labels.push($(e).text());
	}));
	this.googleBookmarksHack(bm);
	//console.log("from google: " + this.s(bm));

	if (bm.labels.length <= 0)
		o.bookmarks[bm.url] = bm;

	$(bm.labels).each(this.bind(function(lblId, l) {
		l = this.separator? l.split(this.separator): [l];
		var i;
		for (i = 0; i < l.length; i++) {
			var source = i == 0? o: bm.labels[lblId];
			bm.labels[lblId] = source.labels[l[i]]
				? (source.labels[l[i]])
				: (source.labels[l[i]] = {title: l[i], bookmarks: {}, labels:{}, parent: source, 
					path: source.path == ""? l[i]: (source.path + this.separator + l[i])});
		}
		bm.labels[lblId].bookmarks[bm.url] = bm;
		//console.log(this.s(bm.labels[i].title) + " now has " + this.s(bm.title) + " = " + this.s(bm.url));
	}));
},

googleBookmarksHack: function(bm) {
	if (bm.url && bm.url.match(/^\w+:\/\/+[^\/]+$/)) {
		bm.url += "/";
	}
},

countNumBookmarks: function(data, contains) {
	var num = 0;
	for (var url in data.bookmarks) {
		var found = false;
		for (var i = 0; !found && i < contains.length; i++)
			found = contains[i] == url;
		if (!found) {
			contains.push(url);
			num++;
		}
	}
	for (var lbl in data.labels)
		num += this.countNumBookmarks(data.labels[lbl], contains);
	return num;
},

onGotChromeTreeForSync: function(ary) {
	this.lastSyncBookmarks = this.countNumBookmarks(this.data, []);
	console.log("from google: " + this.lastSyncBookmarks + " bookmarks total"); 

	this.syncTraverseLocalTree(this.trimPrefix.length <= 0, [], ary[0], this.data, 0);
},

syncTraverseLocalTree: function(started, path, node, label, levels) {

	if (levels == 0)
		this.rootFolders = [];
	levels++;

	var dir = "/" + path.join("/");
	//console.log("syncTraverseLocalTree: path=" + this.s(dir) + 
	//	(started? " label=" + (label? this.s(label.path): null): ""));

	if (started)
		if (! this.syncLabelFromGoogle(dir, label, node))
			return;

	var children = node.children;
	var i, len = children && children.length, j;

	for (i = 0; i < len; i++) {
		var child = children[i];

		if (child.url)
			continue;

		//console.log(this.strRepeat(" ", levels), child.title);
		if (levels == 1)
			this.rootFolders.push(child.title);
		var childPath = path.slice(0);
		childPath.push(child.title);

		if (started) {
			this.syncTraverseLocalTree(true, childPath, child, label.labels[child.title], levels);
			delete label.labels[child.title];

		} else {
			var recurse = true, starting = true;

			for(j = 0; j< this.trimPrefix.length; j++)
				if (childPath.length <= j) {
					starting = false;
					break;
				} else if (childPath[j].toUpperCase() != this.trimPrefix[j].toUpperCase()) {
					recurse = false;
					break;
				}

			if (recurse) {
				if (this.lastBookmarksBarId == undefined)
					this.lastBookmarksBarId = child.id;
				this.foundBookmarksFolder++;
				if (starting) {
					//console.log("--------------starting");
				}
				this.syncTraverseLocalTree(starting, childPath, child, label, levels);
			}
		}
	}

	if (started)
		for (var name in label.labels) {
			var childPath = path.slice(0);
			childPath.push(name);
			this.syncCreateSubtree(childPath, node, label.labels[name]);
		}
},

syncCreateSubtree: function(path, node, label) {
	var dir = "/" + path.join("/");
	console.log("creating: " + this.s(dir) + " from label=" + this.s(label.path));
	chrome.bookmarks.create({
		parentId: node.id,
		title: label.title
	}, this.bindSync(function(created) {
		this.syncTraverseLocalTree(true, path, created, label);
	}));
},

syncLabelFromGoogle: function(dir, label, node) {
	if (! label) {
		console.log("removing: " + this.s(dir));
		return chrome.bookmarks.removeTree(node.id, this.bindSync(null))? false: false;
	}

	$(node.children? node.children: []).each(this.bind(function(i, child) {
		if (!child.url)
			return true;

		var bm = label.bookmarks[child.url];
		if (!bm) {
			console.log("removing: " + this.s(child) + " from " + this.s(dir));
			return chrome.bookmarks.remove(child.id, this.bindSync(null))? true: true;
		}

		delete label.bookmarks[child.url];

		if (bm.title != child.title) {
			var update = {title: bm.title, url: bm.url};
			console.log("updating: id=" + child.id + " in " + this.s(dir) + " to " + this.s(update));
			chrome.bookmarks.update(child.id, update, this.bindSync(null));
		} else {
			//console.log("already up to date: " + this.s(child));
		}

		return true;
	}));

	for (var url in label.bookmarks) {
		var bm = label.bookmarks[url];
		var creating = {
			url: bm.url,
			title: bm.title,
			parentId: node.id
		};
		console.log("creating: in " + this.s(dir) + " " + this.s(creating));
		chrome.bookmarks.create(creating, this.bindSync(null));
	}

	return true;
},

onRemoved: function(id, parentId) {
},

onMoved: function(id, oldParentId, newParentId) {
	this.sortParentId(newParentId);
},

onChanged: function(id, title, url) {
	chrome.bookmarks.get(id, this.bind(function(nodes) {
		if (nodes && nodes[0])
			this.sortParentId(nodes[0].parentId);
	}));
},

onCreated: function(id, title, url, parentId) {
	this.sortParentId(parentId);
},

sortParentId: function(id) {
	chrome.bookmarks.getChildren(id, this.bind(function(children) {
		if (children && children.length)
			this.sortParent(id, children);
	}));
},

sortParent: function(parentId, c) {

	if (!c || c.length <= 1)
		return;

	var i, j, k = 0, last = c.length - 1;

	for (i = c.length; --i > 0; k++) {
		var b = c[last];

		for (j = last; --j >= k;) {
			var a = c[j];

			if (b.url)
				if (a.url)
					if (b.title.toLowerCase() < a.title.toLowerCase()) {
						c[j] = b;
						c[j + 1] = a;
					} else
						b = a;
				else
					b = a;
			else if (a.url || b.title.toLowerCase() < a.title.toLowerCase()) {
				c[j] = b;
				c[j + 1] = a;
			} else
				b = a;
		}
	}

	//console.log("sort: parentId = " + parentId);
	for (i = 0; i < c.length; i++) {
		//console.log(i + ": " + this.s(c[i].title) + " " + (c[i].url? this.s(c[i].url): "[folder]"));
	}

	// nothing to do since chrome doesn't support changing position for now
},

s: function(s) {
	return s == null? null: s == undefined? undefined: JSON.stringify(s);
},

strRepeat: function(s, r) {
	var x = "";
	for (var i = 0; i < r; i++)
		x += s;
	return x;
}
});

