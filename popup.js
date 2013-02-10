$(function() {
  
arguments.callee.syncNow = function() {
  this.enableBtn(false);
  this.setBtnText("Synchronising...");
  this.getXml();
};
  
  arguments.callee.enableBtn = function(tf) {
      if (tf) 
          this.jbtn.removeAttr("disabled");
      else
          this.jbtn.attr("disabled", "disabled");
  };
  
  arguments.callee.getBtnText = function() {
  return this.jbtn.text();
  };
  
  arguments.callee.setBtnText = function(text) {
  this.jbtn.text(text);
  };
  
  arguments.callee.appendBtnText = function(text) {
  this.setBtnText(this.getBtnText() + text);
  };
  
  arguments.callee.debug = function(text) {
  return;
  var d = $("<div></div>");
  d.text(text);
  $("#debug").append(d);
  };
  
  arguments.callee.gotXml = function(xml) {
      var bookmarks = $(xml).find("xml_api_reply > bookmarks > bookmark");
      this.debug("count = " + bookmarks.length);
      
      var self = this;
      
      var noLabels = [];
      var labels = {};
      bookmarks.each(function(index, Element) {
             
             Element = $(Element);
             
             var item = {};
             var labelStrings = [];

             item.labels = labelStrings;
             item.title = $.trim(Element.find("title").text());
             item.url = $.trim(Element.find("url").text());
             
             Element.find("labels > label").each(function(index, lbElement){
                                                    lbElement = $(lbElement);
                                                    
                                                    var label = $.trim(lbElement.text());
                                                 
                                                 if (!(label in labels)) 
                                                 labels[label] = {name: label, fromGoogle: []};   
                                                 
                                                    var labelItem = labels[label];
                                                    labelStrings[labelStrings.length] = labelItem;

                                                 var items = labelItem.fromGoogle;
                                                    items[items.length] = item;
                                                    
                                                    });
                                                    
             if (labelStrings.length <= 0)
             noLabels[noLabels.length] = item;
             
      });

      this.debug(Object.keys(labels).length + "labels");
      this.debug(noLabels.length + " with no label ");

      chrome.bookmarks.getTree(function (nodes)  {
                                          var i, node, j;
                                          for (i = 0; i < nodes.length; i++) {
                                              node = nodes[i];
                                              
                                              for (j = 0; j < node.children.length; j++) 
                                                    self.gotBookmarkCategory(noLabels, labels, node.children[j]);
                                            
                                              break;
                                          }
                          });
  };
  
  arguments.callee.gotBookmarkCategory = function(noLabels, labels, node) {
      var i;
      
      var title = $.trim(node.title);
      this.debug("category: " + title);
      
      if (title == "Bookmarks Bar") {
          this.debug("found Bookmarks Bar");
          this.gotBookmarksBar(noLabels, labels, node);
      }
  
  };
  
  arguments.callee.gotBookmarksBar = function(noLabels, labels, bookmarksBarNode) {

      var i, child, txt;
      for (i = 0; bookmarksBarNode.children && i < bookmarksBarNode.children.length; i++) {
          child = bookmarksBarNode.children[i];
          
          this.debug("Bookmarks Bar item: " + child.title);
          if (child.children) { // is a folder in Bookmarks Bar
  
              this.gotBookmarksBarFolder(noLabels, labels, child);
          }
      }
      
      this.debug(Object.keys(labels).length + " labels not found as folders");
      
      while (Object.keys(labels).length > 0) {
          
          labelText = Object.keys(labels)[0];
          this.createLabel(labelText, labels[labelText].fromGoogle, bookmarksBarNode);
          delete labels[labelText];
      }    


	this.gotBookmarkLabelFolder(null, noLabels, bookmarksBarNode);
  };
  
  arguments.callee.gotBookmarksBarFolder = function(noLabels, labels, folder) {
      
      var labelText = $.trim(folder.title);
      this.debug("Bookmarks Bar folder: " + labelText);
      if (labelText in labels) {
  
          this.debug(labelText + " is a label folder");
          this.gotBookmarkLabelFolder(noLabels, labels[labelText].fromGoogle, folder);
          delete labels[labelText];
      }      
  
  };
  
  arguments.callee.createLabel = function(text, items, bookmarksBarNode) {
      var self = this;
      chrome.bookmarks.create({parentId: bookmarksBarNode.id, title: text}, function(node) {
                          self.debug("created a label folder: " + node.title);
                          self.gotBookmarkLabelFolder(null, items, node);        
                          });
  };
  
  arguments.callee.gotBookmarkLabelFolder = function(noLabels, labelItems, labelFolder) {
  
      var i, bookmark, j, bookmarkUrl, googleUrl, item, found, self = this;
  
      for (j = 0; j < labelItems.length; j++) {
  
          item = labelItems[j];
          this.debug("found in google bookmark: " + item.title + " = " + item.url);
  
          found = false;
          
          for (i = 0; labelFolder.children && i < labelFolder.children.length; i++) {
              bookmark = labelFolder.children[i];
          
              if (bookmark.children) // is folder in folder
                  continue;
          
              bookmarkUrl = $.trim(bookmark.url);
  
              if (item.url == bookmarkUrl) {
                  if (item.title != bookmark.title) {
                      this.debug("going to rename " + bookmark.title + " in " + labelFolder.title + " to " + item.title);
                      this.renameBookmark(labelFolder.title, bookmark.id, bookmark.title, item.title);
          
                  }
                  found = true;  
              }
 
          }
  
          if (!found) {
              this.debug("going to create in "+labelFolder.title+": " + item.title + " = " + item.url);
              this.createBookmark(labelFolder.id, labelFolder.title, item.title, item.url);
          }
                  
      }
  };
  
  arguments.callee.renameBookmark = function(l, i, t, n) {
      var self = this;
      chrome.bookmarks.update(i, {title: n}, function() {
                          self.debug("renamed " + i + " in " + l + " from " + t + " to " + n);
                          });
  
  };
  
  arguments.callee.createBookmark = function(i, l, t, u) {
      var self = this;
      chrome.bookmarks.create({parentId: i, title: t, url: u}, function() {
                          self.debug("created a bookmark in " + l + ": " + t + " = " + u);
                          });
  };
  
  arguments.callee.gotBookmark = function(index, element) {
  
  this.debug("bookmark " + index);
  var title = $.trim(element.find("title").text());
  this.debug(title);
  var url = $.trim(element.find("url").text());
  var labels = element.find("labels > label");
  
  this.debug("labels = " + labels.length);
  
  var self = this;
  labels.each(function (index, Element)  {
              self.gotBookmarkInLabel(title, url, $(Element).text());
              });
  
  
  };

  arguments.callee.gotBookmarkInLabel = function(title, url, label) {

    
  };
  
arguments.callee.getXml = function() {

  this.debug("sending request");
  var self = this;
  $.ajax({
         type: "GET",
         url: "https://www.google.com/bookmarks/lookup?q=&output=xml",
         dataType: "xml",
         context: this,
         success: function(xml, textStatus, jqXHR) {
         this.xmlSuccess(xml, textStatus, jqXHR); },
         error: function(jqXHR, textStatus, errorThrown) {
         this.xmlError(jqXHR, textStatus, errorThrown); },
         complete: function(jqXHR, textStatus) {
         self.enableBtn(true);
         }
         });

  this.debug("request sent");
};
  
arguments.callee.xmlSuccess = function(xml, textStatus, jqXHR) {
  this.debug("got xml");
  
  this.gotXml(xml);
  this.setBtnText("Success");
};
  
arguments.callee.xmlError = function(jqXHR, textStatus, errorThrown) {
  this.debug("xml error");
  this.setBtnText("Failed!");
};
  
arguments.callee._init = function(jbtn) {
  var self = this;
  this.jbtn = jbtn;
  jbtn.click(function() {self.syncNow();});

  $(function() {
    self.enableBtn(true);
    });
};

arguments.callee._init.call(arguments.callee, $("#btn"));
  
});
