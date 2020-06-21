
function encrypt(message, user) {

	//encodage normal
	let l = storage("local");
	let ran = (Math.floor((Math.random() + 1) * Math.pow(10, 15))).toString();
	let key = CryptoJS.SHA3(user + ran).toString();
	let encr = CryptoJS.AES.encrypt(message, key).toString();

	const package = JSON.stringify({
		ran: ran,
		note: btoa(encr),
		settings: {
			theme: l.theme,
			zoom: l.zoom
		}
	})

	//wrap le tout si ya un mdp

	return password({is: "enc", note: package})
}

function decrypt(package) {

	function applyDecrypt(data) {

		//old version control
		if (data.indexOf(",000000,") !== -1) {

			let arr = data.split(",000000,")
			data = {
				ran: arr[0],
				note: arr[1],
				settings: {
					theme: atob(arr[2]) || "",
					zoom: null
				}
			}
		} else {
			data = JSON.parse(data)
		}

		let l = storage("local")
		let decrypted = ""
		let key = CryptoJS.SHA3(l.user + data.ran).toString()

		try {
			decrypted = CryptoJS.AES.decrypt(atob(data.note), key)
		} catch (error) {
			console.warn("N'a pas pu déchiffrer")
		}

		//ajoute settings si jamais
		if (data.settings.theme) theme(data.settings.theme)
		if (data.settings.zoom) zoom(data.settings.zoom)

		return decrypted.toString(CryptoJS.enc.Utf8)
	}

	//password control
	if (package.indexOf("yaunmdp") !== -1) {

		package = password({is: "dec", note: package})

		//si password est cool
		if (package !== false) {

			dom_note.removeAttribute("disabled")
			dom_note.focus()
			id("settings").className = ""
			return applyDecrypt(package)

		} else {
			//mauvais password
			dom_note.setAttribute("disabled", "")
			id("settings").className = "open"
			dom_password.value = ""
			dom_password.focus()

			return "This note is protected by a password"
		}

	} else {
		//pas de password
		return applyDecrypt(package)
	}
}

function password(arg) {

	const mdp = dom_password.value

	if (arg.is === "enc" && mdp === "") {
		return arg.note
	}

	else if (arg.is === "enc") {
		return "yaunmdp" + btoa(CryptoJS.AES.encrypt(arg.note, mdp).toString())
	}

	else if (arg.is === "dec") {

		let decrypted = false
		arg.note = arg.note.replace("yaunmdp", "")

		try {
			decrypted = CryptoJS.AES
				.decrypt(atob(arg.note), mdp)
				.toString(CryptoJS.enc.Utf8)

		} catch (error) {
			console.warn("N'a pas pu déchiffrer")
			decrypted = false
		}

		return decrypted
	}
}

function isLoggedIn() {

	//check on page load si le localStorage a le username
	//si oui on affiche le username, cherche la note et affiche
	//si non on enleve le username present pour pas d'ambiguité

	var l = storage("local");
	var hash = window.location.hash.substr(1);

	if (hash !== "") {

		dom_username.value = hash
		login()

	} else {

		if (l.user) {

			getusername()
			dom_note.focus()
			toServer("lol", l.filename, "read")

		} else {
			login()
		}
	}

	
}

function getusername(state, name) {

	//dechiffre du storage le username pour pouvoir le réafficher à chaque relogin
	//affiche le header geopattern

	let l = storage("local");

	let dec = CryptoJS.AES.decrypt(atob(l.encoded), l.user);
	dec = dec.toString(CryptoJS.enc.Utf8);

	dom_pattern.style.backgroundImage = GeoPattern.generate(dec).toDataUrl()
	dom_username.value = dec
}

function login() {

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
		dom_pattern.style.backgroundImage = GeoPattern.generate(plaintext).toDataUrl()
		window.location.href = window.location.pathname + "#" + plaintext
	}

	//defini les variables
	let l = storage("local");
	let user = dom_username.value;
	l.user = CryptoJS.SHA3(user).toString();

	//ajoute username et enregistre
	filename(l.user);
	setusername(user);
	storage("local", l);

	//focus la note et refresh la note
	dom_note.focus()
	toServer("lol", l.filename, "read");
}

function updateNote() {

	let local = storage("local");
	let session = storage("session");

	if (dom_note.value == "") {
		toServer("", local.filename, "send");
	} else {
		session.sent = encrypt(dom_note.value, local.user);
		toServer(session.sent, local.filename, "send");
	}
	
	storage("session", session)
	alert("Sent !")
}

function toServer(data, filename, option) {

	//listen
	firebase.database().ref(filename).on('value', function(snapshot) {

		const read_val = snapshot.val()

		if (read_val) {

			dom_note.value = decrypt(read_val)
			alert("Received !")

			let storagesession = storage("session")
			storagesession.rece = read_val
			storage("session", storagesession)
		}

		console.log(read_val)
	})

	//updates
	if (option === "send") {
		firebase.database().ref(filename).set(data)
	}

	//read once
	else if (option === "read") {

		alert("Loading...")

		return firebase.database().ref(filename).once('value').then(function(snapshot) {

			if (snapshot.val()) decrypt(snapshot.val())
		})
	}

	//erase
	else if (option === "erase") {
		firebase.database().ref(filename).set(null)
	}
}

function alert(state) {

	clearTimeout(alertTimeout)
	const alert = id("alert")
	alert.innerText = state

	alert.className = "visible"
	alertTimeout = setTimeout(function() {alert.className = ""}, 1000)
}

//globalooo
let typingTimeout = 0, alertTimeout = 0
const setuserinputwidth = (elem=dom_username, backspace) => elem.style.width = `calc(7.2px * ${elem.value.length + (backspace ? 0 : 2)})`

window.onload = function() {

	//main
	dom_username.onkeydown = function(e) {

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

	dom_note.onkeydown = function() {
			
		//commence un timer de .7s
		//se reset a chaque keypress et enregistre la note si le timer est dépassé

		alert("Typing...");
		clearTimeout(typingTimeout);
		typingTimeout = setTimeout(function() {
			updateNote()
		}, 700);
	}


	//settings
	dom_password.onkeypress = function(e) {
		
		let received = ""
		let l = storage("local")

		try {
			received = JSON.parse(sessionStorage.paste).rece
		} catch(e) {
			console.warn("nothing received yet")
		}

		//quand on enter
		if (e.keyCode === 13) {

			l.password = (this.value !== "" ? true : false) //si mdp vide, false
			storage("local", l)

			//si 
			(!received ? dom_note.focus() : dom_note.value = decrypt(received))
		}
	}

	dom_background.oninput = function () {
		theme(this.value, true)
	}

	dom_zoom.oninput = function () {
		zoom(this.value, true)
	}

	dom_erase.onclick = function () {
		erase()
	}

	id('toSettings').onclick = function () {
		dom_settings.className = (dom_settings.className !== "open" ? "open" : "")
	}

	id("connected").className = "loaded"

	isLoggedIn()
	setuserinputwidth()
}