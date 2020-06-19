
function storage(type, data) {

	//initialise le storage de paste en mettant
	//toute les variables dans un array "paste", dans local et session Storage

	if (type == "session") {

		if (data) {
			sessionStorage.paste = JSON.stringify(data);
		}
		else {
			if (sessionStorage.paste) {
				return JSON.parse(sessionStorage.paste);
			} else {
				let x = {
					sent: "",
					rece: "",
				}
				sessionStorage.paste = JSON.stringify(x);
				return JSON.parse(sessionStorage.paste);
			}
		}
	}

	if (type == "local") {
		if (data) {
			localStorage.paste = JSON.stringify(data);
		}
		else {

			if (localStorage.paste) {
				return JSON.parse(localStorage.paste);
			} else {
				let x = {
					user: "",
					encoded: "",
					filename: "",
					theme: "",
					zoom: 1
				}
				localStorage.paste = JSON.stringify(x);
				return JSON.parse(localStorage.paste);
			}
		}
	}
}

function removeUserData(local) {
	local.user = ""
	local.encoded = ""
	local.filename = ""
	storage("local", local)

	sessionStorage.removeItem("paste");
}

function encrypt(message, user) {

	//ran: calcul bien trop compliqué pour pas grand chose, sert d'IV à la clé d'encryption
	//ajoute ran au hash user pour que le message soit toujours encrypté avec une clé differente
	//encrypte avec le hash de ran + user, rajoute ran au debut du message encrypté
	//ran peut être découvert, il randomise seulement un peu plus l'encryption

	let l = storage("local");
	let ran = (Math.floor((Math.random() + 1) * Math.pow(10, 15))).toString();
	let key = CryptoJS.SHA3(user + ran).toString();
	let encr = CryptoJS.AES.encrypt(message, key).toString();

	let full = ran + ",000000," + btoa(encr) + (l.theme !== "" ? ",000000," + btoa(l.theme) : "");

	return full;
}

function decrypt(message) {

	let l = storage("local");
	//ajoute le random a la clé pour pouvoir déchiffrer
	let arr = message.split(",000000,");
	let key = CryptoJS.SHA3(l.user + arr[0]).toString();

	if (arr[2]) {
		theme(atob(arr[2]))
	}

	try {

		let dec = CryptoJS.AES.decrypt(atob(arr[1]), key);
		return dec.toString(CryptoJS.enc.Utf8)

	} catch(e) {

		//empeche d'envoyer un message d'erreur si le déchiffrage ne fonctionne pas
		//pour eviter un leak ou truc du genre jsp
		return "";
	}
}

function isLoggedIn() {

	//check on page load si le localStorage a le username
	//si oui on affiche le username, cherche la note et affiche
	//si non on enleve le username present pour pas d'ambiguité

	var l = storage("local");
	var hash = window.location.hash.substr(1);

	if (hash != "") {

		removeUserData(l)
		id("username").value = hash
		setuserinputwidth()
		login()

	} else {

		if (l.user) {

			getusername();
			id("note").focus();
			toServer("lol", l.filename, "read");

		} else {
			login();
		}
	}

	
}

function getusername(state, name) {

	//dechiffre du storage le username pour pouvoir le réafficher à chaque relogin
	//affiche le header geopattern

	let l = storage("local");

	let dec = CryptoJS.AES.decrypt(atob(l.encoded), l.user);
	dec = dec.toString(CryptoJS.enc.Utf8);

	$('#pattern').geopattern(dec);
	$("#username").val(dec);
}

function login() {

	var l = storage("local");

	function filename(input) {
		
		//prend les 64 premiers char de user, les hash, en prend 64 sur 256
		//devient le nom du fichier a sauvegarder, differant du nom d'utilisateur

		if (!l.filename) {

			let fn = input.substring(0, 64);
			fn = CryptoJS.SHA3(fn, { outputLength: 64 }).toString();

			l.filename = fn;
		}
	}

	function setusername(plaintext) {

		//encode le username
		//affiche le header geopattern

		let enc = btoa(CryptoJS.AES.encrypt(plaintext, l.user).toString());
		l.encoded = enc;
		$('#pattern').geopattern(plaintext);
		$(location).attr('href', window.location.pathname + "#" + plaintext)
	}


	//defini les variables
	var user = $("#username").val();
	l.user = CryptoJS.SHA3(user).toString();

	//ajoute username et enregistre
	filename(l.user);
	setusername(user);
	storage("local", l);

	//focus la note et refresh la note
	$("#note").focus();
	toServer("lol", l.filename, "read");
}

function isTyping() {

	//commence un timer de .7s
	//se reset a chaque keypress et enregistre la note si le timer est dépassé

	var l = storage("local");
	var user = l.user;
	var file = l.filename;

	alertCtrl("Typing...");

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(function () {

    	let sstore = storage("session");
    	let rawnote = $("#note").val();

    	//si on supprime le contenu de #note, reset le fichier serveur en envoyant une string vide
    	//sinon envoyer la note encrypté
    	if (rawnote == "") {
    		toServer("--", file, "send");
    	} else {
    		sstore.sent = encrypt(rawnote, user);
    		toServer(sstore.sent, file, "send");
    	}
        
        storage("session", sstore);
		alertCtrl("Sent !");

    }, 700);
}

function toServer(data, fnam, func) {

	//assez moche
	//data a envoyer, nom du fichier a localiser et la fonction a effectuer par le serveur
	//si read, dechiffrer la note, alerter et enregistrer dans session

	var xhr = new XMLHttpRequest(),
		method = "POST",
		url = "save.php";

	let send ="data="
		+ (func === "read" ? "lol" : data)
		+ "&fnam=" + fnam
		+ "&func=" + func;

	xhr.open(method, url, true);
	xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

	xhr.onreadystatechange = function () {
		if(xhr.readyState === 4 && xhr.status === 200) {
			
			if (func === "read") {

				let rep = xhr.responseText;

				$("#note").val(decrypt(rep));
				alertCtrl("Received");
				
				var s = storage("session");
				s.rece = rep;
				storage("session", s);
			}
		}
	};
	xhr.send(send);
}

function alertCtrl(state) {

	//la petite popup pour dire qu'une action a été effectué

	clearTimeout(alertTimeout);
	var a = $("#alert");
	a.html(state);

	a.css("opacity", 1);
	alertTimeout = setTimeout(function() {
		a.css("opacity", 0);
	}, 1000);
}

function theme(color, init) {

	function applyTheme(val) {

		function textColorSelection(hex) {
			
			if (hex.length === 3) {
				hex = 
					parseInt(hex[0]**2, 16)
					+ parseInt(hex[1]**2, 16)
					+ parseInt(hex[2]**2, 16)
			}
			else if (hex.length === 6) {
				hex = 
					parseInt(hex[0] + hex[1], 16)
					+ parseInt(hex[2] + hex[3], 16)
					+ parseInt(hex[4] + hex[5], 16)
			}
			else {
				return false
			}

			return ((hex / 765) > .5 ? "black" : "white") 
		}

		let textColor = textColorSelection(val.replace("#", ""))

		//doesnt apply colors that can't be contrasted properly
		if (textColor) {
			document.body.style.background = (val.indexOf("#") === -1 ? "#" + val : val)
			document.body.style.color = textColor
		}
	}

	let l = storage("local")

	if (init) {

		applyTheme(l.theme)
		id("background").value = l.theme

	} else {
		applyTheme(color);
		l.theme = color;
		storage("local", l);
	}
}

function settings() {

	function erase() {

		//envoie erase au serv, vide la note, efface le storage, retourne sur index
	
		function deleteAll() {
	
			let l = storage("local");
			toServer("lol", l.filename, "erase");
	
			localStorage.removeItem("paste");
			sessionStorage.removeItem("paste");
	
			location.replace("index.html");
		}
	
		if (conf) {
			clearTimeout(confTimer)
			id('erase').innerText = "Erase from server"
			conf = false
			deleteAll()
			
		} else {
			id('erase').innerText = "Are you sure ?"
			conf = true
			confTimer = setTimeout(function() {
				id('erase').innerText = "Erase from server"
				conf = false
			}, 2000)
		}
	}

	function zoom(val, init) {

		let l = storage("local")

		if (init) {

			id("zoom").value = l.zoom
			document.body.style.zoom = l.zoom

		} else {
			document.body.style.zoom = val
			l.zoom = val
			storage("local", l)
		}
	}

	let conf = false, confTimer = 0
	
	id("background").oninput = function() {
		theme(this.value)
	}
	
	id("zoom").oninput = function() {
		zoom(this.value)
	}

	id('erase').onclick = function() {
		erase()
	}

	id('toSettings').onclick = function() {
		//idk felt sexy, might delete later
		const dom = id('settings')
		dom.className = (dom.className !== "open" ? "open" : "")
	}
	
	theme(null, true)
	zoom(null, true)
	id("connected").className = "loaded"
}

//globalooo
let typingTimeout = 0, alertTimeout = 0
const id = elem => document.getElementById(elem)
const setuserinputwidth = (elem=id("username"), backspace) => elem.style.width = `calc(7.2px * ${elem.value.length + (backspace ? 0 : 2)})`

window.onload = function() {

	//quand on appuie sur entrée dans le username input
	id("username").onkeydown = function(e) {

		if (e.keyCode === 8) {
			setuserinputwidth(this, true)
		}
		else if (e.keyCode === 13) {
			removeUserData(storage("local"));
			login();
			return false;
		}
		else {
			setuserinputwidth(this)
		}
	}

	//les fameux paste et keypress
	$("#note").on("paste", () => {
		isTyping();
	});

	$("#note").keydown(() => {
		isTyping();
	});

	//les boutons settings
	id("refresh").onclick = function() {
		alertCtrl("Refreshed !")
		toServer("lol", storage("local").filename, "read")
	}


	isLoggedIn()
	settings()
};