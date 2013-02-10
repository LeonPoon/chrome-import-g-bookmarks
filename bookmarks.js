chrome.bookmarks.onRemoved.addListener(function(id, removeInfo) {
	/* removeInfo:
		- index
		- parentId
	 */
	console.log("removed: id=" + id + ", removeInfo=" + JSON.stringify(removeInfo));
	ext.onRemoved(id, removeInfo.parentId);
});
chrome.bookmarks.onMoved.addListener(function(id, moveInfo) {
	/* moveInfo:
		- index
		- oldParentId
		- parentId
		- oldIndex
	 */
	console.log("moved: id=" + id + ", moveInfo=" + JSON.stringify(moveInfo));
	ext.onMoved(id, moveInfo.oldParentId, moveInfo.parentId);
});
chrome.bookmarks.onChanged.addListener(function(id, changeInfo) {
	/* changeInfo:
		- url
		- title
	 */
	console.log("changed: id=" + id + ", changeInfo=" + JSON.stringify(changeInfo));
	ext.onChanged(id, changeInfo.title, changeInfo.url);
});
chrome.bookmarks.onCreated.addListener(function(id, bookmark) {
	/* bookmark is of type BookmarkTreeNode.
		http://developer.chrome.com/extensions/bookmarks.html#type-BookmarkTreeNode
		- index
		- dateAdded
		- title
		- url
		- dateGroupModified
		- id
		- parentId
		- children (array of BookmarkTreeNode)
	 */
	console.log("created: id=" + id + ", bookmark=" + JSON.stringify(bookmark));
	ext.onCreated(id, bookmark.title, bookmark.url, bookmark.parentId);
});
