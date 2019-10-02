
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
					theme: ""
				}
				localStorage.paste = JSON.stringify(x);
				return JSON.parse(localStorage.paste);
			}
		}
	}
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

	let full = ran + ",000000," + btoa(encr);

	return full;
}

function decrypt(message) {

	let l = storage("local");
	//ajoute le random a la clé pour pouvoir déchiffrer
	let arr = message.split(",000000,");
	let key = CryptoJS.SHA3(l.user + arr[0]).toString();

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
	//si non on efface le storage pour pas d'ambiguité

	var l = storage("local");
	var hash = window.location.hash.substr(1);

	if (hash != "") {

		localStorage.removeItem("paste");
		sessionStorage.removeItem("paste");
		$(".username input").val(hash);
		login();

	} else {

		if (l.user) {

			getusername();
			$("#note").focus();
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

	$(".geopattern").geopattern(dec);
	$(".username input").val(dec);
}

function setusername(plaintext) {

	var l = storage("local");

	//encode le username
	//affiche le header geopattern

	let enc = btoa(CryptoJS.AES.encrypt(plaintext, l.user).toString());
	l.encoded = enc;
	$(".geopattern").geopattern(plaintext);
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


	//defini les variables
	var user = $(".username input").val();
	l.user = CryptoJS.SHA3(user).toString();

	//ajoute username et enregistre
	filename(l.user);
	setusername(user);
	storage("local", l);

	//focus la note et refresh la note
	$("#note").focus();
	toServer("lol", l.filename, "read");
}



//quand on appuie sur entrée dans le username input
/*$(".username input").keypress(function(e) {
	if (e.keyCode == 13) {
		preventDefault();
		localStorage.removeItem("paste");
		sessionStorage.removeItem("paste");
        login();
        return false;
    }
});

$(".username button").click(function() {
	localStorage.removeItem("paste");
	sessionStorage.removeItem("paste");
    login();
});
*/
//globalooo
var timeout;

function isTyping() {

	//commence un timer de .7s
	//se reset a chaque keypress et enregistre la note si le timer est dépassé

	var l = storage("local");
	var user = l.user;
	var file = l.filename;

    clearTimeout(timeout);

    timeout = setTimeout(function () {

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

    }, 1000);
}

//les fameux paste et keypress
$("#note").on("paste", () => {
	isTyping();
});

$("#note").keydown(() => {
	isTyping();
});

//les boutons settings
$(".btnRefresh").click(() => {
	let l = storage("local");
	toServer("lol", l.filename, "read");
});


function toServer(data, fnam, func) {

	//assez moche
	//data a envoyer, nom du fichier a localiser et la fonction a effectuer par le serveur
	//si read, dechiffrer la note, alerter et enregistrer dans session

	var xhr = new XMLHttpRequest(),
		method = "POST",
		url = "save.php";
	var send;

	if (func === "send") {
		send = "data=" + data + "&fnam=" + fnam + "&func=" + func;
	}
	if (func === "read") {
		send = "data=lol&fnam=" + fnam + "&func=" + func;
	}

	xhr.open(method, url, true);
	xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

	xhr.onreadystatechange = function () {
		if(xhr.readyState === 4 && xhr.status === 200) {
			
			if (func === "read") {

				let rep = xhr.responseText;

				$("#note").val(decrypt(rep));
				
				var s = storage("session");
				s.rece = rep;
				storage("session", s);
			}
		}
	};
	xhr.send(send);
}

function isMobile() {

	if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4)))
	{
		return true;
	} else {
		return false;
	}
}

function theme(state) {

	if ($("body").hasClass("dark")) {

		$("body").removeClass("dark");
		$(".param .light").toggleClass("active");

		localStorage.theme = "light";

	} else {

		$("body").addClass("dark");
		$(".param .light").toggleClass("active");

		localStorage.theme = "dark";
	}
}

$(".param .light, .param .night").click(function() {
	theme();
});



function submit() {

	function inputval() {
		return $("input[name='username']").val();
	}


	$("input[name='username']").keyup(function(e) {

		if (inputval().length < 7) {
			$("button.submit").attr("disabled", "");
			$("button.submit").css("width", "0");
		}
		else if (inputval().length > 7) {
			$("button.submit").css("width", "2.5em");
			$("button.submit").removeAttr("disabled");
		}

		if (e.keyCode !== 13) {
			$("button.submit .submitting").removeClass("active");
		}

		if (e.keyCode === 13) {
			$("button.submit .submitting").addClass("active");
			$("#note").focus();
		}
	});

	$("input[name='username']").change(function() {
		if (inputval().length > 7) {
			$("button.submit .submitting").addClass("active");
			$("#note").focus();
		}
	});

	$("button.submit").click(function() {
		if (inputval().length > 7) {
			$("button.submit .submitting").addClass("active");
			$("#note").focus();
		}
	});
}

function pin(state) {

	var input = $("input[name='lockpin']");

	if (state === "switch") {

		if ($(".lockpin").hasClass("active")) {

			$(".lockpin").removeClass("active");
			makeSpaceInSettings("pin", true);

		} else {
			
			$(".lockpin").addClass("active");
			makeSpaceInSettings("pin", false);

			input.focus();
			input.val("");
		}
	}


	if (state === "setup") {

		//si premier setup
		if (!localStorage.pinState) {

			//enregistre le pin
			localStorage.pin = input.val();
			localStorage.pinState = "confirm";

			//reset l'input
			input.val("");
			input.focus();
			input.attr("placeholder", "confirm PIN");
		}

		//si confirmation du pin
		else if (localStorage.pinState === "confirm") {

			//si 2e = 1e pin
			if (localStorage.pin === input.val()) {

				//le pin est activé
				$(".lockpin").removeClass("active");
				$(".erase").removeClass("hidden");
				$(".pin.switch .top").addClass("active");
				$(".settings").css("margin-left", "0");

				input.attr("placeholder", "type last PIN");
				localStorage.pinState = "activated";

			//si il n'est pas egal
			} else {
				input.val("");
				input.focus();
			}
		}

		//si un pin est déjà présent
		else if (localStorage.pinState === "activated") {

			//si c'est le bon dernier pin
			if (localStorage.pin === input.val()) {

				localStorage.removeItem("pinState");
				localStorage.removeItem("pin");
				input.val("");
				input.attr("placeholder", "type PIN");
				$(".pin.switch .top").removeClass("active");

			} else {

				input.val("");
				input.focus();
			}
		}
	}
}


$(".param.pin").click(function() {
	pin("switch");
	resetSettings("erase");
})

$(".lockpin .cancel").click(function() {
	pin("switch")
})

$(".lockpin .confirm").click(function() {
	pin("setup")
})

$("input[name='lockpin']").keyup(function(e) {
	if (e.keyCode === 13) {
		pin("setup")
	}
})


function randomizeUsername() {

	$("input[name='username']").val("");
	$("input[name='username']").focus();
	$("button.submit .submitting").removeClass("active");

	var inter = setInterval(function() {

		var input = $("input[name='username']");

		if (input.val().length === 12) {
			
			$("button.submit").click()
			clearInterval(inter)
			return true
		}

		var randNum = String.fromCharCode(Math.round(Math.random() * (57 - 48)) + 48);
		var randLower = String.fromCharCode(Math.round(Math.random() * (122 - 97)) + 97);

		input.val(input.val() + (Math.random() > .5 ? randNum : randLower));

	}, 40);

	setusername($("input[name='username']").val());
}

function erase(yes) {

	if (!localStorage.eraseConf) {

		$(".param.erase .top").addClass("active");
		$(".eraseconf").addClass("active");
		makeSpaceInSettings("erase", false);

		localStorage.eraseConf = true;
	}

	else if (localStorage.eraseConf && localStorage.eraseConf == "true") {

		$(".param.erase .top").removeClass("active");
		$(".eraseconf").removeClass("active");
		makeSpaceInSettings("erase", true);

		localStorage.removeItem("eraseConf");

		//si user a cliqué oui
		if (yes) {

			$("#note").val("");
			$(".goSettings").click();
			randomizeUsername();
			//suppr le user et fait un random
		}
	}
}

$(".param.erase").click(function() {
	erase()
	resetSettings("pin")
})

$(".eraseconf .cancel").click(function() {
	erase()
})

$(".eraseconf .confirm").click(function() {
	erase(true)
})

function makeSpaceInSettings(setting, isActive) {

	//si la fenetre fait moins de 700px
	if ($(window).width() < 700) {

		//qu'on veut changer pin
		if (setting === "pin") {

			//et qu'il est actuellement activé
			if (isActive) {

				$(".settings").css("margin-left", "0");
				$(".param.erase").removeClass("hidden");

			} else {

				$(".settings").css("margin-left", "-7em");
				$(".param.erase").addClass("hidden");
			}
		}

		//qu'on veut changer erase
		else if (setting === "erase") {

			//et qu'il est actuellement activé
			if (isActive) {
				$(".settings").css("margin-left", "0");
			} else {
				$(".settings").css("margin-left", "-14em");
			}
		}
	}
}

function initSettings() {

	var l = localStorage;

	if (l.pin && l.pinState === "activated") {
		$(".pin.switch .top").addClass("active");
		$("input[name='lockpin']").attr("placeholder", "type last PIN");
	}

	if (l.theme && l.theme === "dark") {
		$("body").addClass("dark");
		$(".param .light").toggleClass("active");
	}
}

function resetSettings(setting) {


	if (setting === "pin") {
		makeSpaceInSettings("pin", true);
		$(".lockpin").removeClass("active");

		$("input[name='lockpin']").val("");
	}

	if (setting === "erase") {

		makeSpaceInSettings("erase", true);
		$(".param.erase .top").removeClass("active");
		$(".eraseconf").removeClass("active");
		localStorage.removeItem("eraseConf");
	}
}

$(".goSettings").click(function() {

	$(".flexwrap").toggleClass("pushed");
	$(".goSettings").toggleClass("pushed");
});

window.onload = function() {
	isLoggedIn();
	submit();
	initSettings();
};