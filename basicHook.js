var motd=document.getElementById("motd");

function r(x) {return x; }

function showTime() {
	motd.innerText=window.PLAYER.getTime(r);
}

function tick() {
	showTime();
	requestAnimationFrame(tick);
}

tick();