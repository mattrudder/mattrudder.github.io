/**
* Tatsu v0.1.0 (Built 2012-08-07)
* Copyright (c) 2012 Matt Rudder
* http://tatsujs.com/
*/

define('Tatsu/Console', function () {
	"use strict";

	var history = [],
		con = window.console,
		wrapper = {
			log: function() {
				history.push( arguments );

				con && con.log[ con.firebug ?
					'apply' : 'call']( con, Array.prototype.slice.call( arguments ) );
			}
		};

	return wrapper;
});
define('Tatsu/Game', [
	'require',
	'Utility/Utility',
	'Tatsu/Console',
	'Tatsu/Graphics',
	'Tatsu/Keyboard',
	'Tatsu/ResourceLoader',
	'Tatsu/Resources/ImageResource',
	'Tatsu/Resources/JsonResource'],
	function(r, Util, console, Graphics, Keyboard, ResourceLoader) {
	'use strict';

	var defaults = {
			clearColor: 'black'
		},
		defaultState = {
			isLoaded: false,
			resources: {},
			onEnter: Util.noop,
			onPreDraw: Util.noop,
			onPostDraw: Util.noop,
			onUpdate: Util.noop,
			onExit: Util.noop
		},
		knownStates = [];

	function setupRaf() {
		// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
		var lastTime = 0,
			vendors = ['ms', 'moz', 'webkit', 'o'];

		for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] ||
				window[vendors[x]+'CancelRequestAnimationFrame'];
		}

		if (!window.requestAnimationFrame) {
			window.requestAnimationFrame = function(callback, element) {
				var currentTime = new Date().getTime(),
					timeToCall = Math.max(0, 16 - (currentTime - lastTime)),
					id;

				id = window.setTimeout(function() {
					callback(currentTime + timeToCall);
				}, timeToCall);

				lastTime = currentTime + timeToCall;
				return id;
			};
		}

		if (!window.cancelAnimationFrame) {
			window.cancelAnimationFrame = function(id) {
				clearTimeout(id);
			};
		}
	}

	function Game(options) {
		var self = this,
			screenSize,
			incomingState = null,
			outgoingState = null;

		this.size = function () {
			return screenSize;
		};

		this.pushState = function (state) {
			var i, compHandler = null, progHandler = null;

			if (incomingState !== null)
				throw 'Multiple transition states specified!';

			incomingState = state;

			function onProgress(e) {
				incomingState.progress = e.finishedCount / e.totalCount;
			}

			function onComplete(e) {
				incomingState.isLoaded = true;

				self.loader.removeProgressListener(progHandler);
				self.loader.removeCompletionListener(compHandler);
			}

			if (incomingState.preload) {
				progHandler = self.loader.addProgressListener(onProgress);
				compHandler = self.loader.addCompletionListener(onComplete);

				Util.extend(incomingState.resources, self.loader.preload(incomingState.preload));
				self.loader.start();
			}
			else {
				incomingState.isLoaded = true;
			}
		};

		this.popState = function () {
			if (outgoingState !== null)
				throw 'Multiple transition states specified!';

			outgoingState = currentState(this);
		};

		this.options = Util.extend({}, defaults, options);

		this.loader = new ResourceLoader({
			resourceRoot: this.options.resourceRoot,
			resourceTypes: [r('Tatsu/Resources/ImageResource'), r('Tatsu/Resources/JsonResource')]
		});

		screenSize = this.options.screenSize || {
			width: this.options.canvas.width,
			height: this.options.canvas.height
		};

		this.keyboard = new Keyboard();
		this.graphics = new Graphics({
			screenSize: screenSize,
			canvas: this.options.canvas
		});

		this.stateStack = [];

		function onPreDraw() {
			var state = currentState(self);
			state.onPreDraw.call(state, self);
		}

		function onPostDraw() {
			var ctx = self.graphics.context2D(),
				state = currentState(self);

			state.onPostDraw.call(state, self);

			if (incomingState && incomingState.progress) {
				// TODO: Allow states to provide progress drawing?
				ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
				ctx.fillRect(4, screenSize.height - 20, (screenSize.width - 8) * incomingState.progress, 16);
			}
		}

		function onUpdate(dt) {
			var state = currentState(self);
			state.onUpdate.call(state, self, dt);
		}

		function draw() {
			self.graphics.clear(self.options.clearColor || 'black');

			onPreDraw();

			// TODO: Draw retained mode elements here (environment, sprites, etc).

			onPostDraw();

			self.graphics.present();
		}

		function setupDrawTimer() {
			var lastFrame = +new Date();

			function loop(now) {
				var dt, state;

				self.timerId = window.requestAnimationFrame(loop, self.graphics.canvasElem);
				dt = now - lastFrame;

				// TODO: Investigate best value for stopping render.
				if (dt < 250) {
					if (outgoingState) {
						// TODO: Support transitions between states.
						outgoingState.onExit.call(state, self);
						self.stateStack.pop();

						state = currentState(self);
						state.onEnter.call(state, self);

						outgoingState = null;
					}

					onUpdate(dt);
					draw();

					if (incomingState && incomingState.isLoaded) {
						// TODO: Support transitions between states.
						state = currentState(self);
						state.onEnter.call(state, self);

						self.stateStack.push(incomingState);
						incomingState.onEnter.call(incomingState, self);

						incomingState = null;
					}
				}

				lastFrame = now;
			}

			loop(lastFrame);
		}

		function tearDownDrawTimer() {
			window.cancelAnimationFrame(self.timerId);
		}

		if (self.options.initialState) {
			self.pushState(self.options.initialState);
		}

		setupDrawTimer();
	}

	function currentState(self) {
		return self.stateStack.length ? self.stateStack[self.stateStack.length - 1] : defaultState;
	}

	Game.createState = function (state) {
		state = Util.extend({}, defaultState, state);
		knownStates.push(state);

		return state;
	};

	setupRaf();

	return Game;
});
define('Tatsu/Gamepad', function () {
	'use strict';

	// TODO: Integrate with Gamepad API
	return function () {
	};
});
define('Tatsu/Graphics', ['Utility/Utility'], function (Util) {
	'use strict';

	var defaults = {
            scaleMode: 'pixel'
        },
        imageSmoothingDisabled = false;

	function Graphics(options) {
        var i, vendors = ['moz', 'webkit', 'o', 'ms'], ctx2d = null;

        this.options = Util.extend({}, defaults, options);
		ctx2d = this.options.canvas.getContext('2d');

        if (this.options.scaleMode === 'pixel') {
            (function () {
                if (ctx2d.imageSmoothingEnabled) {
                    imageSmoothingDisabled = true;
                    ctx2d.imageSmoothingEnabled = false;
                    return;
                }
                else
                {
                    for (i = 0; i < vendors.length; ++i) {
                        if (ctx2d[vendors[i] + 'ImageSmoothingEnabled']) {
                            imageSmoothingDisabled = true;
                            ctx2d[vendors[i] + 'ImageSmoothingEnabled'] = false;
                            return;
                        }
                    }
                }

                //this.options.scaleMode = 'stretch';
                if (console) {
                    console.warn('scaleMode "pixel" is not supported on this browser! Defaulting to "stretch".');
                }
            }());
        }

		// NOTE: In 3D mode, context2D should be able to emulate canvas rendering above/below 3D content
		this.context2D = function () {
			return ctx2d;
		};

		this.clear = function (clearColor) {
			ctx2d.save();
			ctx2d.beginPath();
			ctx2d.rect(0, 0, this.options.screenSize.width, this.options.screenSize.height);
			ctx2d.clip();

			ctx2d.fillStyle = clearColor || 'black';
			ctx2d.fillRect(0, 0, this.options.screenSize.width, this.options.screenSize.height);
		};

		this.present = function () {
			var srcWidth = this.options.screenSize.width,
				srcHeight = this.options.screenSize.height,
				destWidth = this.options.canvas.width,
				destHeight = this.options.canvas.height,
				zoomX, zoomY, imgData;

			ctx2d.restore(); // end clip

			if (destWidth !== srcWidth || destHeight !== srcHeight) {
				if (this.options.scaleMode !== 'pixel' || imageSmoothingDisabled) {
					ctx2d.drawImage(this.options.canvas, 0, 0, srcWidth, srcHeight, 0, 0, destWidth, destHeight);
				}
				else {
					ctx2d.drawImage(this.options.canvas, 0, 0, srcWidth, srcHeight, 0, 0, destWidth, destHeight);

					// Fallback image resize. (read: sloooooooooow!)
//                zoomX = destWidth / srcWidth;
//                zoomY = destHeight / srcHeight;
//
//                imgData = new Uint8ClampedArray(ctx2d.getImageData(0, 0, srcHeight, srcHeight).data);
//
//                for (var y = 0; y < srcHeight; ++y) {
//                    for (var x = 0; x < srcWidth; ++x) {
//                        // Find the starting index in the one-dimensional image data
//                        var i = (y * srcWidth + x) * 4;
//                        var r = imgData[i + 0];
//                        var g = imgData[i + 1];
//                        var b = imgData[i + 2];
//                        var a = imgData[i + 3];
//
//                        if (x > 0) {
//                            var i2 = (y * srcWidth + x - 1) * 4;
//                            var r2 = imgData[i + 0];
//                            var g2 = imgData[i + 1];
//                            var b2 = imgData[i + 2];
//                            var a2 = imgData[i + 3];
//                        }
//
//                        ctx2d.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (a / 255) + ")";
//                        ctx2d.fillRect(x * zoomX, y * zoomY, zoomX, zoomY);
//                    }
//                }
				}
			}
		};
	}

	return Graphics;
});
define('Tatsu/Keyboard', function () {
	'use strict';

	var KeyNames = {
			8: 'backspace', 9: 'tab', 13: 'enter',
			16: 'shift', 17: 'ctrl', 18: 'alt',
			20: 'caps_lock',
			27: 'esc',
			32: 'space',
			33: 'page_up', 34: 'page_down',
			35: 'end', 36: 'home',
			37: 'left', 38: 'up', 39: 'right', 40: 'down',
			45: 'insert', 46: 'delete',
			48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
			65: 'a', 66: 'b', 67: 'c', 68: 'd', 69: 'e', 70: 'f', 71: 'g', 72: 'h', 73: 'i', 74: 'j', 75: 'k', 76: 'l', 77: 'm', 78: 'n', 79: 'o', 80: 'p', 81: 'q', 82: 'r', 83: 's', 84: 't', 85: 'u', 86: 'v', 87: 'w', 88: 'x', 89: 'y', 90: 'z',
			91: 'super',
			96: 'num_0', 97: 'num_1', 98: 'num_2', 99: 'num_3', 100: 'num_4', 101: 'num_5', 102: 'num_6', 103: 'num_7', 104: 'num_8', 105: 'num_9', 106: 'num_star', 107: 'num_plus', 109: 'num_minus', 110: 'num_del', 111: 'num_divide',
			112: 'f1', 113: 'f2', 114: 'f3', 115: 'f4', 116: 'f5', 117: 'f6', 118: 'f7', 119: 'f8', 120: 'f9', 121: 'f10', 122: 'f11', 123: 'f12',
			144: 'num_lock',
			187: 'minus', 189: 'equals',
			192: 'grave'
		},
		KeyCodes = {},
		Modifiers = ['shift', 'ctrl', 'alt'];

	// Static initializer
	(function () {
		// Generate inverse lookup table from KeyNames -> KeyCodes
		for (var key in KeyNames) {
			if (Object.prototype.hasOwnProperty.call(KeyNames, key)) {
				KeyCodes[KeyNames[key]] = +key;
			}
		}
	}());

	function Keyboard() {
		var i,
			self = this,
			onKeyUp,
			onKeyDown;

		function createKeyHandler(upDown) {
			return function (e) {
				var i, keyName;

				e = e || window.event;

				self.lastKeyCode = e.keyCode;
				keyName = KeyNames[self.lastKeyCode];

				// Update modifiers
				for (i = 0; i < Modifiers.length; ++i)
					self.lastModifiers[Modifiers[i]] = e[Modifiers[i] + 'Key'];

				if (Modifiers.indexOf(keyName) !== -1)
					self.lastModifiers[keyName] = true;

				self.lastState[keyName] = upDown === 'Down';

				// TODO: Handle keys registered for events.
				// TODO: preventDefault on keys who's handlers return false.
			};
		}

		onKeyUp = createKeyHandler('Up');
		onKeyDown = createKeyHandler('Down');

		this.lastKeyCode = -1;
		this.lastModifiers = {};
		for (i = 0; i < Modifiers.length; ++i)
			this.lastModifiers[Modifiers[i]] = false;

		this.lastState = {};
		for (i = 0; i < KeyNames.length; ++i)
			this.lastState[KeyNames[i]] = false;

		window.addEventListener('keydown', onKeyDown, false);
		window.addEventListener('keyup', onKeyUp, false);
		window.addEventListener('unload', function onUnload() {
			window.removeEventListener('keydown', onKeyDown, false);
			window.removeEventListener('keyup', onKeyUp, false);
			window.removeEventListener('unload', onUnload, false);
		}, false);
	}

	Keyboard.prototype.isKeyDown = function (keyName) {
		return this.lastState[keyName];
	};

	Keyboard.prototype.isKeyUp = function (keyName) {
		return !this.lastState[keyName];
	};

	return Keyboard;
});
define('Tatsu/ResourceLoader', ['Utility/Utility', 'Tatsu/Console', 'Utility/Path'], function (Util, console, Path) {
	"use strict";

	var defaults = {
			resourceRoot: '/',
			resourceTypes: [],
			autoStart: true,
			statusInterval: 5000,
			loggingDelay: 20 * 1000,
			timeout: Infinity
		},
		ResourceState = {
			QUEUED: 0,
			WAITING: 1,
			LOADED: 2,
			ERROR: 3,
			TIMEOUT: 4
		};

	function ResourceLoader (options) {
		var self = this,
			entries = {},
			progressListeners = [],
			lastProgressChange = +new Date,
			timeStarted = null;

		function fetchResource(url, loadedOnly) {
			var i,
				extension,
				createFunc = null,
				entry = entries[url];

			loadedOnly = loadedOnly || false;

			if (entry) {
				return loadedOnly && entry.status !== ResourceState.LOADED ? null : entry.resource;
			}
			else if (url.length > 0) {
				extension = Path.parseUri(url).file;
				extension = extension.substr(extension.lastIndexOf('.') + 1);

				for (i = 0; i < self.options.resourceTypes.length; ++i) {
					if (self.options.resourceTypes[i].extensions.indexOf(extension) !== -1) {
						createFunc = self.options.resourceTypes[i].create;
					}
				}

				if (!createFunc)
					throw 'Resource loader not found for extension ".' + extension + '".';

				entry = {
					status: ResourceState.QUEUED,
					resource: createFunc(url, self)
				};

				entries[url] = entry;

				if (timeStarted === null && self.options.autoStart) {
					if (self.options.autoStart) {
						self.start();
					}
				}
				else {
					entry.status = ResourceState.WAITING;
					entry.resource.start();
				}

				if (!loadedOnly)
					return entry.resource;
			}

			return null;
		}

		this.preload = function (preloaderMap) {
			var key, url, resource, resourceMap = {};

			for (key in preloaderMap) {
				url = preloaderMap[key];

				if (typeof url !== 'string') {
					console.warn('Resource list contains a non-string value.');
					continue;
				}

				resource = fetchResource(Path.combine(this.options.resourceRoot, url), false);
				resourceMap[key] = resource !== null ? resource.data() : null;
			}

			return resourceMap;
		};

		this.load = function (url) {
			var resource;

			if (typeof url !== 'string')
				throw 'Resource url is not a string.';

			url = Path.combine(this.options.resourceRoot, url);
			resource = fetchResource(url, true);

			return resource !== null ? resource.data() : null;
		};

		this.start = function () {
			var key, entry;

			if (timeStarted !== null)
				return;

			timeStarted = +new Date;

			for(key in entries) {
				entry = entries[key];

				if (entry.status === ResourceState.QUEUED) {
					entry.status = ResourceState.WAITING;
					entry.resource.start();
				}
			}

			// Quick status check, in case we have cached files.
			setTimeout(statusCheck, 100);
		};

		this.log = function(showAll) {
			var i = 1, key, entry, message,
				elapsedSeconds = Math.round((+new Date - timeStarted) / 1000);

			console.log('ResourceLoader elapsed: ' + elapsedSeconds + ' sec');

			for (key in entries) {
				entry = entries[key];

				if (!showAll && entry.status !== ResourceState.WAITING)
					continue;

				message = 'ResourceLoader #' + i + ' [' + entry.resource.url() + '] ';
				switch (entry.status) {
					case ResourceState.QUEUED:
						message += '(Not Started)';
						break;
					case ResourceState.WAITING:
						message += '(Waiting)';
						break;
					case ResourceState.LOADED:
						message += '(Loaded)';
						break;
					case ResourceState.ERROR:
						message += '(Error)';
						break;
					case ResourceState.TIMEOUT:
						message += '(Timeout)';
						break;
				}

				console.log(message);
				i++;
			}
		};

		function statusCheck() {
			var key, entry,
				checkAgain = false,
				deltaTime = (+new Date) - lastProgressChange,
				timedOut = (deltaTime >= self.options.timeout),
				shouldLog = (deltaTime >= self.options.loggingDelay);

			for(key in entries) {
				entry = entries[key];

				if (entry.status !== ResourceState.WAITING)
					continue;

				if (entry.resource.checkStatus)
					entry.resource.checkStatus();

				if (entry.status === ResourceState.WAITING) {
					if (timedOut) {
						entry.resource.onTimeout();
					}
					else {
						checkAgain = true;
					}
				}
			}

			if (checkAgain) {
				if (shouldLog)
					self.log();

				setTimeout(statusCheck, self.options.statusInterval);
			}
			else {
				onFinished();
			}
		}

		function onFinished() {
			self.log(true);

			timeStarted = null;
		}

		function sendProgress(globalData, updatedEntry, listener) {
			listener(Util.extend(globalData, {
				resource: updatedEntry.resource,
				loaded: (updatedEntry.status === ResourceState.LOADED),
				error: (updatedEntry.status === ResourceState.ERROR),
				timeout: (updatedEntry.status === ResourceState.TIMEOUT)
			}));
		}

		function onProgress (resource, statusType) {
			var i,
				key,
				entry = null,
				currentEntry = null,
				listener,
				finished = 0,
				total = 0,
				globalStatus;

			for (key in entries) {
				currentEntry = entries[key];
				if (currentEntry !== null && currentEntry.resource === resource) {
					entry = currentEntry;
				}

				total++;
				if (currentEntry.status === ResourceState.LOADED || currentEntry.status === ResourceState.ERROR || currentEntry.status === ResourceState.TIMEOUT) {
					finished++;
				}
			}

			if (entry === null || entry.status !== ResourceState.WAITING)
				return;

			entry.status = statusType;
			if (entry.status === ResourceState.LOADED || entry.status === ResourceState.ERROR || entry.status === ResourceState.TIMEOUT) {
				finished++;
			}

			lastProgressChange = +new Date();

			globalStatus = {
				finishedCount: finished,
				totalCount: total
			}

			for (i = 0; i < progressListeners.length; ++i) {
				listener = progressListeners[i];
				sendProgress(globalStatus, entry, listener);
			}
		}

		this.onLoad = function (resource) {
			onProgress(resource, ResourceState.LOADED);
		};

		this.onError = function (resource) {
			onProgress(resource, ResourceState.ERROR);
		};

		this.onTimeout = function (resource) {
			onProgress(resource, ResourceState.TIMEOUT);
		};

		this.addProgressListener = function (handler) {
			progressListeners.unshift(handler);

			return handler;
		};

		this.addCompletionListener = function (handler) {
			var wrapper = function (e) {
				if (e.finishedCount === e.totalCount) {
					handler();
				}
			};

			progressListeners.push(wrapper);

			return wrapper;
		};

		this.removeProgressListener = function (handler) {
			var i;

			for (i = 0; i < progressListeners.length; ++i) {
				if (progressListeners[i] === handler) {
					progressListeners.splice(i, 1);
					return;
				}
			}
		};

		this.removeCompletionListener = function (handler) {
			self.removeProgressListener(handler);
		};

		this.options = Util.extend({}, defaults, options);
		this.options.resourceRoot = Path.resolve(this.options.resourceRoot);
	}

	return ResourceLoader;
});
define('Tatsu/Resources/ImageResource', function () {
	"use strict";

	function ImageResource (fileUrl, loader) {
		var self = this;

		function bind(name, handler) {
			if (self.image.addEventListener) {
				self.image.addEventListener(name, handler, false);
			}
			else if (self.image.attachEvent) {
				self.image.attachEvent('on' + name, handler);
			}
		}

		function unbind(name, handler) {
			if (self.image.removeEventListener) {
				self.image.removeEventListener(name, handler, false);
			}
			else if (self.image.removeEventListener) {
				self.image.removeEventListener('on' + name, handler);
			}
		}

		function removeEventHandlers() {
			unbind('load', onLoad);
			unbind('readystatechange', onReadyStateChange);
			unbind('error', onError);
		}

		function onReadyStateChange() {
			if (self.image.readyState === 'complete') {
				removeEventHandlers();
				loader.onLoad(self);
			}
		}

		function onLoad() {
			removeEventHandlers();
			loader.onLoad(self);
		}

		function onError() {
			removeEventHandlers();
			loader.onError(self);
		}

		// Public interface.
		this.image = new Image();

		this.start = function () {
			bind('load', onLoad);
			bind('readystatechange', onReadyStateChange);
			bind('error', onError);

			self.image.src = fileUrl;
		};

		this.checkStatus = function () {
			if (self.image.complete) {
				removeEventHandlers();
				loader.onLoad(self);
			}
		};

		this.onTimeout = function () {
			removeEventHandlers();
			if (self.image.complete) {
				loader.onLoad(self);
			}
			else {
				loader.onTimeout(self);
			}
		};

		this.url = function () {
			return fileUrl;
		};

		this.data = function () {
			return self.image;
		};
	}

	return {
		extensions: ['png', 'jpeg', 'jpg', 'gif', 'bmp'],
		create: function (url, loader) {
			return new ImageResource(url, loader);
		}
	};
});
define('Tatsu/Resources/JsonResource', ['Utility/Utility', 'Utility/Ajax'], function (Util, Ajax) {
	"use strict";

	function JsonResource (fileUrl, loader) {
		var self = this,
			request = null,
			retObject = {};

		function onLoad(json) {
			Util.extend(retObject, json);
			loader.onLoad(self);
		}

		function onError() {
			loader.onError(self);
		}

		// Public interface.
		this.start = function () {
			request = Ajax.ajax({
				url: fileUrl,
				type: 'GET',
				dataType: 'json',
				success: onLoad,
				error: onError
			});
		};

		this.checkStatus = function () {
			if (request && request.readyState === 4) {
				loader.onLoad(self);
			}
		};

		this.onTimeout = function () {
			if (request && request.readyState === 4) {
				loader.onLoad(self);
			}
			else {
				request.abort();
				loader.onTimeout(self);
			}

			request = null;
		};

		this.url = function () {
			return fileUrl;
		};

		this.data = function () {
			return retObject;
		};
	}

	return {
		extensions: ['js', 'json', 'map'],
		create: function (url, loader) {
			return new JsonResource(url, loader);
		}
	};
});
define('Tatsu/Tilemap', ['Utility/Utility', 'Utility/Ajax'], function (Util, Ajax) {
	"use strict";

	var defaults = {};

	function Tilemap (options) {
		this.options = Util.extend({}, defaults, options);

		Ajax.getJSON(this.options.url, function (data) {
			console.log(data);
		});
	}

	return Tilemap;
});
define('Utility/Ajax', ['Utility/Utility'], function (Util) {
	var get,
		getJson;

	ajax = function (url, options) {
		var xhr = new XMLHttpRequest(),
			settings;

		if (options === undefined) {
			options = url;
			url = null;
		}

		settings = Util.extend({
			type: 'GET',
			dataType: null,
			success: null,
			error: null,
			complete: Util.noop
		}, options);

		function parseResponse() {
			if (settings.dataType) {
				if (settings.dataType === 'json') {
					return JSON.parse(xhr.reponseText);
				}
			}
			else if (xhr && xhr.responseType) {
				if (xhr.responseType === 'json') {
					return JSON.parse(xhr.reponseText);
				}
			}

			return xhr.responseText;
		}

		xhr.onreadystatechange = function() {
			var res;

			if (xhr.readyState === 4) {
				res = parseResponse();

				if (settings.success && xhr.status === 200) {
					settings.success(xhr, res);
				}
				else if (settings.error) {
					settings.error(xhr, res);
				}

				settings.complete(xhr, res);
			}
		};

		xhr.open(url || settings.url, url, true);
		xhr.send();
	};

	getJSON = function (url, callback) {
		ajax(url, {
			complete: function (xhr, responseText) {
				var json = null;

				if (xhr.status === 200) {
					json = JSON.parse(responseText);
				}

				callback(json, xhr.status);
			}
		})
	};

	return {
		ajax: ajax,
		getJSON: getJSON
	};
});
define('Utility/Path', function () {
	"use strict";

	var anchor = document.createElement('a'), // Phony anchor used to resolve relative paths.
        parseUri = function (str) {
		    var	o   = {
                    strictMode: true,
                    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
                    q:   {
                        name:   "queryKey",
                        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
                    },
                    parser: {
                        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
                    }
			    },
                m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
                uri = {},
                i   = 14;

			while (i--) uri[o.key[i]] = m[i] || "";

			uri[o.q.name] = {};
			uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
				if ($1) uri[o.q.name][$1] = $2;
			});

			return uri;
		},
        resolve = function (path) {
            anchor.href = path;
            return anchor.href;
        },
		isAbsolute = function (path) {
			var uri = path;

			if (typeof uri === 'string')
				uri = parseUri(uri);

			return uri.protocol.length > 0 || uri.path.substring(0, 1) === '/';
		},
		isRelative = function (path) {
			return !isAbsolute(path);
		},
		toString = function (uri) {
			var uriBuilder = '';

			if (uri.protocol.length > 0)
				uriBuilder = uri.protocol + '://';

			uriBuilder += uri.authority;
			uriBuilder += uri.relative;

			return uriBuilder;
		},
		combine = function (paths) {
			var i, currentPath = null, lastPath = null;

			if (!paths)
				throw 'Invalid paths';

			if (typeof paths === 'string')
				paths = Array.prototype.slice.call(arguments, 0);

			for (i = 0; i < paths.length; ++i) {
				lastPath = currentPath;
				currentPath = paths[i];

				if (typeof currentPath !== 'string')
					throw 'Invalid path at index ' + i;

				currentPath = parseUri(currentPath);

				if (currentPath && lastPath && isRelative(currentPath)) {
					currentPath = parseUri(toString(lastPath) + (lastPath.relative.substr(lastPath.relative.length - 1) === '/' ? '' : '/') + currentPath.relative);
				}
			}

			return toString(currentPath);
		};

	return {
        parseUri: parseUri,
		isAbsolute: isAbsolute,
		isRelative: isRelative,
        resolve: resolve,
		combine: combine
	};
});
define('Utility/Utility', function () {
	"use strict";

	var class2type = {},
		extend,
		each,
		isArray,
		isFunction,
		noop,
		type;

		extend = function() {
			var i,
				name, src, copy,
				options,
				target = arguments[0] || {},
				length = arguments.length;

			if (typeof target !== 'object') {
				target = {};
			}

			for (i = 1; i < length; ++i) {
				options = arguments[i];
				if (options != null) {
					for (name in options) {
						src = target[name];
						copy = options[name];

						if (target === copy) {
							continue;
						}

						if (copy !== undefined) {
							target[name] = copy;
						}
					}
				}
			}

			return target;
		};

		each = function (obj, callback) {
			var i = 0,
				name,
				length = obj.length,
				isObject = length === undefined || isFunction(obj);

			if (isObject) {
				for (name in obj) {
					if (callback.call(obj[name], name, obj[name]) === false) {
						break;
					}
				}
			}
			else {
				for (i = 0; i < length; ++i) {
					if (callback.call(obj[i], i, obj[i]) === false) {
						break;
					}
				}
			}

			return obj;
		};

		isArray = function (obj) {
			return type(obj) === 'array';
		};

		isFunction = function (obj) {
			return type(obj) === 'function';
		};

		noop = function () {};

		type = function (obj) {
			return obj == null ?
				String(obj) :
				class2type[Object.prototype.toString.call(obj)] || 'object';
		};

	each(['Boolean', 'Number', 'String', 'Function', 'Array', 'Date', 'RegExp', 'Object'], function (i, name) {
		class2type['[object ' + name + ']'] = name.toLowerCase();
	});
	
	return {
		extend: extend,
		each: each,
		isArray: isArray,
		isFunction: isFunction,
		noop: noop,
		type: type
	};
});