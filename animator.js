'use strict';

var motd=document.getElementById("motd");

function r(x) {return x; }
function getVideoTime() {return window.PLAYER.getTime(r);}

function AnimScript(animator,src) {
	this.animator=animator;
	this.ready=false;

	this.nextAnimIndex=0;

	var requestSuccess=function () {
		if(this.xhr.status!=200) {
			requestFail();
			return;
		}
		
		this.vid=this.xhr.response.vid;
		this.animations=this.xhr.response.animations;
		this.ready=true;
		this.onLoad();
	}.bind(this);
	
	var requestFail=function() {
		makeAlert("Animation script download failure", "The animation script for the video failed to download.","",true);
	}.bind(this);

	this.load=function () {
		this.xhr=new XMLHttpRequest();
		this.xhr.responseType="json";
		this.xhr.addEventListener("load",requestSuccess);
		this.xhr.addEventListener("error",requestFail);
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
	
	this.pause=function() {
		clearTimeout(this.animStartTimeout);
	}.bind(this);
	
	this.play=function() {
		this.waitForNextAnim();
	}
	
	this.cleanup=function() {
		this.xhr.abort();
		clearTimeout(this.animStartTimeout);
	}.bind(this);
	
	this.seek=function() {
		clearTimeout(this.animStartTimeout);
		nextAnimIndex=0;
		this.waitForNextAnim();
	}.bind(this);
}

function Animation(anim) {
	this.anim=anim;
	
	this.active=true;
	
	this.elm=$(anim.selector);
	this.length=anim.endTime-anim.startTime;
	
	this.inTime=function(currentTime) {
		if(currentTime>anim.endTime) return false;
		if(currentTime<anim.startTime) return false;
		return true;
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
		this.setPropVal(this.getValForGlobalTime(currentTime));
	}.bind(this);
	
	this.getValForGlobalTime=function(time) {
		time-=anim.startTime;
		var progress=time/this.length;
		
		//TODO: color interpolation
		
		return anim.startValue*(1-progress)+anim.endValue*progress;		
	}.bind(this);
	
	this.setPropVal=function(value) {
		this.elm.css(anim.propName,value);
	}
	
	this.finish=function() {
		this.active=false;
		this.setPropVal(anim.endValue);
	}.bind(this);
	
	this.abort=function() {
		this.active=false;
	}.bind(this);
	
	this.pause=function() {
	}.bind(this);
	
	this.resume=function() {
	}.bind(this);
	
	//prepare the element for animation
	for(var i=0;i<this.anim.prep.length;++i) {
		var prep=this.anim.prep[i];
		this.elm.css(prep.name,prep.value);
	}
	
	console.log("New animation",anim);
}

function Animator() {
	this.paused=false;
	this.runningAnimations=[];
	
	this.startAnimation=function(anim) {
		//motd.innerText="Anim "+anim.startTime+" "+anim.endTime;
		this.runningAnimations.splice(this.runningAnimations.length,0,new Animation(anim));
		
		requestAnimationFrame(tick);
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
				this.runningAnimations.splice(i,1);
			}
		}
	}.bind(this);
	
	this.abortAll=function() {
		for(var animation of this.runningAnimations) {
			animation.abort();
		}
	}.bind(this);
	
	this.pause=function() {
		this.paused=true;
		//pause all running animations
		//normally a noop since they are time locked anyway
		for(var animation of this.runningAnimations) {
			animation.pause();
		}
	}.bind(this);
	
	this.resume=function() {
		this.paused=false;
		//resume all running animations
		//normally a noop since they are time locked anyway
		for(var animation of animations) {
			animation.resume();
		}
	}.bind(this);
	
	var tick=function() {
		if(this.paused) return;
		
		updateAnimations();
		
		if(this.runningAnimations.length>0) {
			requestAnimationFrame(tick);
		}
	}.bind(this);
}

function ScriptManager() {
	var animator=new Animator();

	this.loadAnimScript=function(vid,onLoad) {
		this.nextAnimScript=new AnimScript(animator,"https://beta.court-records.net/syncanim/animscripts/"+vid+".json");
		this.nextAnimScript.onLoad=onLoad;
		this.nextAnimScript.load();
	}.bind(this);
	
	var nextScriptLoaded=function() {
	}.bind(this);
	
	var loadNextAnimScript=function() {
		var nextVideo=this.findNextVideo();
		if(!nextVideo) return;
		this.loadAnimScript(nextVideo,nextScriptLoaded);
	}.bind(this);
	
	var startRunningLoadedAnimScript=function() {
		this.currentAnimScript=this.nextAnimScript;
		this.nextAnimScript=null;
		this.currentAnimScript.play();
		loadNextAnimScript();
	}.bind(this);
	
	this.findNextVideo=function () {	
		var li=$(playlistFind(PL_CURRENT));
		li=li.next();
		var media=li.data("media");
		console.log(media);
		
		return "test";
		
		return media.type+"-"+media.id;
	}.bind(this);
	
	this.findCurrentVideo=function () {
		var li=$(playlistFind(PL_CURRENT));
		var media=li.data("media");
		console.log(media);
		
		return "test";
		
		return media.type+"-"+media.id;
		
	}.bind(this);
	
	var onVideoChange=function() {
		//do we have a current animscript?
		if(this.currentAnimScript) {
			//if so, clean it up
			this.currentAnimScript.cleanup();
		}
		
		//stop and clean all running animations
		animator.abortAll();
		
		//check if we have the animscript for the video
		if(this.nextAnimScript) {
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
			this.loadAnimScript(this.findCurrentVideo(),startRunningLoadedAnimScript);
		}
	}.bind(this);
	
	//Warning! not just for remote seeks, also for resyncing seeks!
	var onSeek=function() {
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
	
	var detectSync=function(data) {
	
	}.bind(this);
	
	//hook the socket events
	socket.on("changeMedia",onVideoChange);
	socket.on("playlist",onPlaylistChange);
	socket.on("queue",onPlaylistChange);
	socket.on("moveVideo",onPlaylistChange);
	socket.on("",detectSync);
	
	this.loadAnimScript(this.findCurrentVideo(),startRunningLoadedAnimScript);
}

var manager=new ScriptManager();