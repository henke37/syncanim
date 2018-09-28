'use strict';

//Hack that exploits UB to make getTime synchronous
function r(x) {return x; }
function getVideoTime() {return window.PLAYER.getTime(r);}

var syncAnimRootPath=function () {
	var scriptPath=document.currentScript.src;
	var slashPos=scriptPath.lastIndexOf("/");
	return scriptPath.substring(0,slashPos+1);
}();

function resolveAnimScriptUrl(url) {
	if(url.indexOf("http")===0) return url;
	return syncAnimRootPath+"animscripts/"+url;
}

function LinkManager(rel) {
	this.elements=[];
	
	this.add=function(url) {
		var link=document.createElement("link");
		link.rel=rel;
		link.href=url;
		this.elements.push(link);
		$('head').append(link);
	}.bind(this);
	
	this.clean=function() {
		var head=$("head");
		for(var i=0;i<this.elements.length;++i) {
			var link=this.elements[i];
			$(link).remove();
		}
	}.bind(this);
}

function AnimScript(animator,src) {
	this.animator=animator;
	this.ready=false;

	this.nextAnimIndex=0;
	
	this.preloader=new LinkManager("prefetch");
	this.styler=new LinkManager("stylesheet");

	var requestSuccess=function () {
		if(this.xhr.status!=200) {
			//404 or some such.
			//happens for videos without anim scripts
			//nothing to alert casual viewers about
			requestFail();
			return;
		}
		
		var response=this.xhr.response;
		
		if(!("vid" in response)) {
			requestFail();
			return;
		}
		
		this.vid=response.vid;
		this.animations=response.animations;
		this.animations.sort(function (a,b) {
			if(a.startTime<b.startTime) return-1;
			if(a.startTime>b.startTime) return 1;
			return 0;
		} );
		this.stylesheet=response.stylesheet;
		if(this.stylesheet) {
			this.preloader.add(resolveAnimScriptUrl(this.stylesheet));
		}
		if(response.preload) {			
			for(var url of response.preload) {
				this.preloader.add(resolveAnimScriptUrl(url));
			}
		}
		this.ready=true;
		this.onLoad();
	}.bind(this);
	
	var requestFail=function() {
		if(this.onError) {
			this.onError();
		}
	}.bind(this);
	
	var requestError=function() {
		makeAlert("Error", "Failed to load animation script.", "alert-danger")
		.appendTo($("#announcements"));
		requestFail();
	}

	this.load=function () {
		this.xhr=new XMLHttpRequest();
		this.xhr.responseType="json";
		this.xhr.addEventListener("load",requestSuccess);
		this.xhr.addEventListener("error",requestError);
		this.xhr.open("GET",src);
		this.xhr.send();
	}.bind(this);
	
	this.waitForNextAnim=function() {
		if(this.nextAnimIndex>=this.animations.length) return;
		var anim=this.animations[this.nextAnimIndex];
		
		var startNextAnimation=function() {
			this.animator.startAnimation(anim);
			this.nextAnimIndex++;
			this.waitForNextAnim();
		}.bind(this);
		
		var vt=getVideoTime();
		if(!vt) vt=0;
		var dt=anim.startTime-vt;
		if(vt>=anim.startTime) {
			startNextAnimation();
		} else {
			this.animStartTimeout=setTimeout(this.waitForNextAnim,dt*1000);
		}
	}.bind(this);
	
	this.applyStyleSheet=function() {
		this.styler.add(resolveAnimScriptUrl(this.stylesheet));
	}.bind(this);
	
	this.start=function() {
		if(this.stylesheet) {
			this.applyStyleSheet();
		}
		this.play();
	}
	
	this.pause=function() {
		clearTimeout(this.animStartTimeout);
	}.bind(this);
	
	this.play=function() {
		this.waitForNextAnim();
	}
	
	this.cleanup=function() {
		this.xhr.abort();
		this.preloader.clean();
		this.styler.clean();
		clearTimeout(this.animStartTimeout);
	}.bind(this);
	
	this.seek=function() {
		clearTimeout(this.animStartTimeout);
		this.nextAnimIndex=0;
		this.waitForNextAnim();
	}.bind(this);
}

function parseColor(c) {
	if(c.indexOf("rgb(")==0) {
		var m=c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
		var r=m[1];
		var g=m[2];
		var b=m[3];
	} else if(c.indexOf("#")==0) {
		if(c.length==4) {
			var r=parseInt(c.substr(1,1),16);
			var g=parseInt(c.substr(2,1),16);
			var b=parseInt(c.substr(3,1),16);
			r*=0x11;
			g*=0x11;
			b*=0x11;
		} else {
			var r=parseInt(c.substr(1,2),16);
			var g=parseInt(c.substr(3,2),16);
			var b=parseInt(c.substr(5,2),16);
		}
	}
	return { "r": r, "g": g, "b": b};
}

var interpolators={
	"linear": function(s,e,p) { return s*(1-p)+e*p; },
	"linearRound": function(s,e,p) { return Math.round(s*(1-p)+e*p); },
	"rgbLinear": function(s,e,p) {		
		var rr=s.r*(1-p)+e.r*p;
		var rg=s.g*(1-p)+e.g*p;
		var rb=s.b*(1-p)+e.b*p;
		
		return "rgb("+rr.toFixed(0)+","+rg.toFixed(0)+","+rb.toFixed(0)+")";
	},
	"rgbExp": function(s,e,p) {
		var rr=s.r*s.r*(1-p)+e.r*e.r*p;
		var rg=s.g*s.g*(1-p)+e.g*e.g*p;
		var rb=s.b*s.b*(1-p)+e.b*e.b*p;
		
		rr=Math.sqrt(rr);
		rg=Math.sqrt(rg);
		rb=Math.sqrt(rb);
		
		return "rgb("+rr.toFixed(0)+","+rg.toFixed(0)+","+rb.toFixed(0)+")";
	}
};

var easings= {
	// no easing, no acceleration
	linear: function (t) { return t },
	// accelerating from zero velocity
	easeInQuad: function (t) { return t*t },
	// decelerating to zero velocity
	easeOutQuad: function (t) { return t*(2-t) },
	// acceleration until halfway, then deceleration
	easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
	// accelerating from zero velocity 
	easeInCubic: function (t) { return t*t*t },
	// decelerating to zero velocity 
	easeOutCubic: function (t) { return (--t)*t*t+1 },
	// acceleration until halfway, then deceleration 
	easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
	// accelerating from zero velocity 
	easeInQuart: function (t) { return t*t*t*t },
	// decelerating to zero velocity 
	easeOutQuart: function (t) { return 1-(--t)*t*t*t },
	// acceleration until halfway, then deceleration
	easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
	// accelerating from zero velocity
	easeInQuint: function (t) { return t*t*t*t*t },
	// decelerating to zero velocity
	easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
	// acceleration until halfway, then deceleration 
	easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t }
}

function tokenize(str) {
	return str.split(" ");
}
function untokenize(arr) {
	return arr.join(" ");
}

function applyTemplate(template, val) {
	return template.replace("$", val);
}

function handleUrlFunction(value) {
	function replacer(match,p1) {
		return "url("+resolveAnimScriptUrl(p1)+")";
	}
	value=value.replace(/url\(([^)]*)\)/i,replacer);
	return value;
}

function replaceUrlFunction(value) {
	function replacer(match,p1) {
		return resolveAnimScriptUrl(p1);
	}
	value=value.replace(/url\(([^)]*)\)/i,replacer);
	return value;
}

function undoChanges(changes) {
	for(var change of changes) {
		undoChange(change);
	}
}

function undoChange(change) {
	switch(change.type) {
		case "prop":
			change.elm.css(change.k,change.v);
			break;
		case "att":
			change.elm.attr(change.k,change.v);
			break;
		case "addElement":
			change.elm.remove();
			break;
		case "wrapElement":
			change.wraper.replaceWith(change.elm);
			break;
		default:
			debugger;
	}
}

function Animation(anim) {
	this.anim=anim;
	
	this.active=true;
	
	this.elm=$(anim.selector);
	this.length=anim.endTime-anim.startTime;
	
	var parseVal=function (val) {
		if(this.anim.interpolator=="rgbExp" || this.anim.interpolator=="rgbLinear") {
			return parseColor(val);
		}
		return val;
	}.bind(this);
	
	this.inTime=function(currentTime) {
		if(currentTime>anim.endTime) return false;
		if(currentTime<anim.startTime) return false;
		return true;
	}.bind(this);
	
	this.snapMode=function(currentTime) {
		var	curFrame;
		for(;;) {
			if(this.nextFrame>this.anim.tvframes.length) return;
			var frame=this.anim.tvframes[this.nextFrame];
			if(frame.t>currentTime) break;
			this.nextFrame++;
			curFrame=frame;
		}
		if(curFrame) {
			this.setPropVal(curFrame.v);
		}
	}.bind(this);
	
	this.update=function(currentTime) {
		if(currentTime<anim.startTime) {
			this.abort();
			return;
		}
		if(currentTime>anim.endTime) {
			this.finish();
			return;
		}
		if(anim.frameMode=="snap") {			
			this.snapMode(currentTime);
			return;
		} else if(anim.mode=="createElement" || anim.mode=="removeElement" || anim.mode=="wrapElement") {
			return;
		}
		
		this.setPropVal(this.getValForGlobalTime(currentTime));
	}.bind(this);
	
	this.getValForGlobalTime=function(time) {
		time-=anim.startTime;
		
		var progress=time/this.length;
		
		progress=this.ease(progress);
		
		return this.interpolator(this.startValue,this.endValue,progress);
	}.bind(this);
	
	this.setPropVal=function(value) {
		value+=anim.unit;
		
		value=handleUrlFunction(value);
		
		if("template" in anim) {
			this.elm.css(anim.propName,applyTemplate(anim.template,value));
			return;
		}
		
		if(anim.tokenIndex==-1) {
			this.elm.css(anim.propName,value);
			return;
		}
		
		var cur=this.elm.css(anim.propName);
		cur=tokenize(cur);
		
		cur[anim.tokenIndex]=value;
		
		cur=untokenize(cur);
		
		this.elm.css(anim.propName,cur);
	}
	
	this.finish=function() {
		this.active=false;
		if(this.anim.mode=="tween") {
			this.setPropVal(anim.endValue);
		}
	}.bind(this);
	
	this.abort=function() {
		this.active=false;
		undoChanges(this.changes);
		this.changes=[];
	}.bind(this);
	
	this.pause=function() {
	}.bind(this);
	
	this.resume=function() {
	}.bind(this);
	
	this.changes=[];
	
	if(!("mode" in this.anim)) {
		anim.mode="tween";
	}
	
	if(anim.mode=="createElement") {
		var newElement=$(anim.content);
		this.elm.append(newElement);
		this.elm=newElement;
		this.changes.push( {"type": "addElement", "elm": this.elm} );
	} else if(anim.mode=="removeElement") {
	} else if(anim.mode=="wrapElement") {
		var wraper=$('<div />');
		if("wraperID" in anim) {
			wraper.attr("id",anim.wraperID);
		} else {
			var orgId=this.elm.attr("id");
			if(orgId) {
				wraper.attr("id",orgId+"_wraper");
			}
		}
		this.elm.replaceWith(wraper);
		wraper.append(this.elm);
		this.changes.push( {"type": "wrapElement", "elm": this.elm, "wraper": wraper});
	} else if(anim.mode=="tween") {
		this.preValue=this.elm.css(anim.propName);
		this.changes.push({"k":this.anim.propName, "v": this.preValue, 
		"elm": this.elm, "type": "prop"});
	
		if(!("startValue" in this.anim)) {
			this.startValue=parseVal(this.preValue);
		} else {
			this.startValue=parseVal(this.anim.startValue);
		}
		this.endValue=parseVal(this.anim.endValue);
		if(!("unit" in this.anim)) {
			this.anim.unit="";
		}
		
		if(!("tokenIndex" in this.anim)) {
			this.anim.tokenIndex=-1;
		}
		
		if(!("frameMode" in this.anim)) {
			anim.frameMode="disabled";
		} else {
		
			this.anim.tvframes=function() {
				var out=[];
				for(var t in anim.frames) {
					var v=anim.frames[t];
					out.push({ "t": parseFloat(t), "v": v});
				}
				out.sort(function (a,b) {
					if(a.t<b.t) return-1;
					if(a.t>b.t) return 1;
					return 0;
				});
				return out;
			}();
			this.nextFrame=0;
		}
		
		if("ease" in this.anim) {
			this.ease=easings[this.anim.ease];
		} else {
			this.ease=easings["linear"];
		}
		
		if("interpolator" in this.anim) {
			this.interpolator=interpolators[this.anim.interpolator];
		} else {
			this.interpolator=interpolators["linear"];
		}
	}
	
	if("prep" in this.anim) {
		//prepare the element for animation
		for(var k in this.anim.prep) {
			var v=this.anim.prep[k];
			this.changes.push({ "k": k, "v": this.elm.css(k), "elm": this.elm, "type": "prop" });
			v=handleUrlFunction(v);
			this.elm.css(k,v);
		}
	}
	
	if("prep-atts" in this.anim) {
		for(var k in this.anim["prep-atts"]) {
			var v=this.anim["prep-atts"][k];
			this.changes.push({ "k": k, "v": this.elm.attr(k), "elm": this.elm, "type": "att" });
			v=replaceUrlFunction(v);
			this.elm.attr(k,v);
		}
	}
	
	console.log("New animation",anim);
}

function Animator() {
	this.paused=false;
	this.runningAnimations=[];
	this.pendingChanges=[];
	
	var animationFrameId;
	
	this.startAnimation=function(anim) {
		//motd.innerText="Anim "+anim.startTime+" "+anim.endTime;
		this.runningAnimations.splice(this.runningAnimations.length,0,new Animation(anim));
		
		if(this.runningAnimations.length==1) {
			animationFrameId=requestAnimationFrame(tick);
		}
	}.bind(this);
	
	var updateAnimations=function() {
		//update each running animation
		//and remove any finished ones from the list
		var vt=getVideoTime();
		for(var i=0;i<this.runningAnimations.length;) {
			var animation=this.runningAnimations[i];
			animation.update(vt);
			
			if(animation.active) {
				//only advance if we didn't remove the animation
				//otherwise we'd skip the following one by accident!
				i++;
			} else {
				this.addPendingChanges(animation.changes);
				this.runningAnimations.splice(i,1);
			}
		}
		this.lastUpdateTime=vt;
	}.bind(this);
	
	this.addPendingChanges=function(animChanges) {
		this.pendingChanges=animChanges.concat(this.pendingChanges);
	}.bind(this);
	
	this.abortAll=function() {
		for(var animation of this.runningAnimations) {
			animation.abort();
		}
		this.runningAnimations=[];
		
		cancelAnimationFrame(animationFrameId);
	}.bind(this);
	
	this.endClean=function() {
		this.abortAll();
		undoChanges(this.pendingChanges);
		this.pendingChanges=[];
	}.bind(this);
	
	this.pause=function() {
		this.paused=true;
		//pause all running animations
		//normally a noop since they are time locked anyway
		for(var animation of this.runningAnimations) {
			animation.pause();
		}
		cancelAnimationFrame(animationFrameId);
	}.bind(this);
	
	this.resume=function() {
		this.paused=false;
		//resume all running animations
		//normally a noop since they are time locked anyway
		for(var animation of this.runningAnimations) {
			animation.resume();
		}
		
		if(this.runningAnimations.length) {
			animationFrameId=requestAnimationFrame(tick);
		}
	}.bind(this);
	
	var tick=function() {
		if(this.paused) return;
		
		updateAnimations();
		
		if(this.runningAnimations.length>0) {
			animationFrameId=requestAnimationFrame(tick);
		}
	}.bind(this);
}

function ScriptManager() {
	var animator=new Animator();

	this.loadAnimScript=function(media,onLoad) {
		var vid=media.type+"-"+media.id;
		
		//vid="test";
		
		console.log("Load animation script", media);
		
		this.nextAnimScript=new AnimScript(animator,resolveAnimScriptUrl(vid+".json"));
		this.nextAnimScript.media=media;	
		this.nextAnimScript.onLoad=onLoad;
		this.nextAnimScript.load();
	}.bind(this);
	
	var nextScriptLoaded=function() {
	}.bind(this);
	
	var loadNextAnimScript=function() {
		this.findNextVideo();
		this.loadAnimScript(this.nextMedia,nextScriptLoaded);
	}.bind(this);
	
	var startRunningLoadedAnimScript=function() {
		this.currentAnimScript=this.nextAnimScript;
		this.nextAnimScript=null;
		this.currentAnimScript.start();
		loadNextAnimScript();
	}.bind(this);
	
	var loadFailed=function() {
		loadNextAnimScript();
	}.bind(this);
	
	this.findNextVideo=function () {	
		var li=$(playlistFind(PL_CURRENT));
		if(li.is(":last-child")) {
			li=li.parent().children().first();
		} else {
			li=li.next();
		}
		this.nextMedia=li.data("media");
	}.bind(this);
	
	this.findCurrentVideo=function () {
		var li=$(playlistFind(PL_CURRENT));
		this.currentMedia=li.data("media");
	}.bind(this);
	
	var onVideoChange=function() {
		//do we have a current animscript?
		if(this.currentAnimScript) {
			//if so, clean it up
			this.currentAnimScript.cleanup();
		}
		
		//stop and clean all running animations
		animator.endClean();
		
		this.findCurrentVideo();
		
		//check if we have the animscript for the video
		//Do check that it is for the correct video
		//people do jump in the playlist
		if(this.nextAnimScript && this.nextAnimScript.media==this.currentMedia) {
			//we do? good.
			if(this.nextAnimScript.ready) {
				//is it ready too? if so, start running it.
				startRunningLoadedAnimScript();
			} else {
				//it's not ready? dang. register a listener for when it is
				this.nextAnimScript.onLoad=startRunningLoadedAnimScript;
			}
		} else {
			//we don't have it yet? start loading it and register for when it is ready
			this.loadAnimScript(this.currentMedia,startRunningLoadedAnimScript);
			//try loading the next one even if this one fails
			this.nextAnimScript.onError=loadFailed;
		}
	}.bind(this);
	
	//Warning! not just for remote seeks, also for resyncing seeks!
	var onSeek=function() {
		animator.endClean();
		this.currentAnimScript.seek();
	}.bind(this);
	
	var onPause=function() {
		animator.pause();
		this.currentAnimScript.pause();
	}.bind(this);
	
	var onResume=function() {
		animator.play();
		this.currentAnimScript.resume();
	}.bind(this);
	
	var onPlaylistChange=function() {
		//check if the next video changed
		//if not, we don't care
		
		//throw away the next animscript
		this.nextAnimScript.cleanup();		
		//and load the one for the new next video
		loadNextAnimScript();
	}.bind(this);
	
	//hook the socket events
	function hookSocketEvents() {
		socket.on("changeMedia",onVideoChange);
		socket.on("playlist" ,onPlaylistChange);
		socket.on("queue"    ,onPlaylistChange);
		socket.on("delete"   ,onPlaylistChange);
		socket.on("moveVideo",onPlaylistChange);
		socket.on("partitionChange",hookSocketEvents);
	}
	hookSocketEvents();
	
	onVideoChange();
}

var manager=new ScriptManager();