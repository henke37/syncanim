/** Creates a SynchronizingTimer
@argument timerBase A function that returns the current time in seconds */
function SynchronizingTimer(timeBase) {

	this.timeBase=timeBase;
	
	this.lastBaseTimer=timeBase();
	this.lastTimerVal=performance.now();

	/** Starts the timer 
	@argument interval The sampling interval of the base timer, in milliseconds */
	this.startTimer=function(interval) {
		this.timer=setInterval(this.timerTick,interval);
		this.lastTimerVal=performance.now();
		this.lastBaseTimer=this.timeBase();
	}.bind(this);

	/** Stops the timer */
	this.stopTimer=function() {
		clearInterval(this.timer);
	}.bind(this);
	
	/** @private */
	this.timerTick=function() {
		var thisBaseTimer=this.timeBase();
		
		if(thisBaseTimer==this.lastBaseTimer) return;
		
		this.lastBaseTimer=thisBaseTimer;
		this.lastTimerVal=performance.now();
	}.bind(this);
	
	/** Method that returns the estimated time of the base timer at a higher resolution
	@return The estimated time, in seconds*/
	this.getTime=function() {
		var thisTimerVal=performance.now();
		
		var deltaTimer=thisTimerVal-this.lastTimerVal;
		return this.lastBaseTimer+deltaTimer/1000;
	}.bind(this);
}