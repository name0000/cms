/*
* Floatbox 8.1.1 - 2018-08-19
* Copyright (c) 2018 Byron McGregor
* License: MIT (see LICENSE.txt for details)
* Website: https://floatboxjs.com/
*/

( function ( TRUE, FALSE, NULL, UNDEFINED ) {
	var
		self = window,
		document = self.document,
		fb = self.fb,  // make lint happy
		data = fb.data,

	// api functions defined in floatbox.js
		fbActivate = fb.activate,  // we will replace fb.activate but call the old one
		$ = fb.$,
		select = fb.select,
		require = fb.require,
		extend = fb.extend,
		addEvent = fb.addEvent,
		removeEvent = fb.removeEvent,
		stopEvent = fb.stopEvent,
		serialize = fb.serialize,
		getClass = fb.getClass,
		hasClass = fb.hasClass,
		addClass = fb.addClass,
		attr = fb.attr,
		typeOf = fb.typeOf,
		encodeHTML = fb.encodeHTML,
		decodeHTML = fb.decodeHTML,
		fbPath = fb.path,
		smallScreen = fb.smallScreen,

	// utility functions (and data) from floatbox.js
		setTimer = data.setTimer,
		clearTimer = data.clearTimer,
		trigger = data.trigger,
		parseUrl = data.parseUrl,
		parseOptions = data.parseOptions,
		makeOptionString = data.makeOptionString,
		getOwnerWindow = data.getOwnerWindow,
		placeElement = data.placeElement,
		getTagName = data.getTagName,
		patch = data.patch,
		multiAssign = data.multiAssign,
		deleteProp = data.deleteProp,
		settings = data.settings,
		timeouts = data.timeouts,

	// mathematical minification mechanisms (etc.)
		now = Date.now,
		isArray = Array.isArray,
		math = Math,
		infinity = 1 / 0,
		mathMax = math.max,
		mathMin = math.min,
		mathCeil = math.ceil,
		mathFloor = math.floor,
		mathAbs = math.abs,
		mathPow = math.pow,
		mathRandom = function ( i ) {
			return math.random() * ( i + 1 ) << 0;
		},

	// constants (will get substituted with raw values by the make script)
	// box state
		STATE_end = 0,  // must be falsey, set in phase 0 of end
		STATE_initial = 1,  // set in boot
		STATE_start = 2,  // set at the end of fetchContent for 1st item, just before calling calcSize
		STATE_transition = 3,  // set at the end of showItem, just before calling launchItem
		STATE_show = 4,  // set right at the end of showContent
		STATE_resize = 5,  // set in resizeHandler, mousemoveHandler when dragResizing, and in resize()
	// timers
		TIMER_slideshow = 1,
		TIMER_slow = 2,
		TIMER_end = 3,
		TIMER_mouseup = 4,
		TIMER_tap = 5,
		TIMER_show = 6,
		TIMER_tooltip = 7,
		TIMER_viewport = 8,
	// string indices
		STR_close = 1,
		STR_prev = 2,
		STR_next = 3,
		STR_play = 4,
		STR_pause = 5,
		STR_resize = 6,
		STR_image = 7,
		STR_page = 8,
		STR_item = 9,
		STR_info = 10,
		STR_print = 11,
		STR_open = 12,
		STR_popup = 13,
	// option settings
		OPT_none = 0,
		OPT_default = 1,
		OPT_one = 1,  // bit flags for none/either/both options
		OPT_two = 2,
		OPT_both = 3,  // OPT_one | OPT_two
	// imageTransition
		OPT_crossfade = 1,
		OPT_slide = 2,
		OPT_expand = 3,
		OPT_shift = 4,
		OPT_fade = 5,
	// resize state
		SIZE_large = 3,
		SIZE_small = 2,
		SIZE_native = 1,

	// odds and sods
		preloads = {},  // fb.preload keeps its results here
		cyclers = [],
		popups = [],
		previousViewport = {},
		zeroes = [ 0, 0, 0, 0 ],
		captionNames = [ 'caption', 'caption2', 'header', 'footer' ],
		aboutBlank = 'about:blank',
		rexHtml = /<.+>/,
		bigNumber = 77777,  // various uses, including default base z-index
		cycleInterval = 6,  // default
		strings,
		icons,
		usingTouch,
		popupLocked,
		showAtLoad,

	// browser info
		isWebkit,
		isIos,
		isMac,
		scrollbarSize,

	// things set in coreInit after floatbox.js:init has run
		baseSettings,
		classSettings,
		typeSettings,
		resourcesFolder,
		blankGif,
		waitGif,
		zoomInCursor,
		zoomOutCursor,
		contextClass,
		tooltipClass,
		cyclerClass,
		preloadLimit,

	// top window references and data to support boxes attaching there
		topWin,
		topDoc,
		topFb,
		topData,
		topUrl,
		newElement,
		tapDetails,
		viewport,
		clientOffset,
		visualOffset,
		firstEvents,
		offHints,
		items,
		instances;

///  begin api functions

	function activate( $root ) {
		// A more complete replacement for fb.activate defined in floatbox.js.
		// That one lights up only standard floatbox links.
		// This one does all the goodies like cyclers and tooltips and whatnots.
		var
			$link,
			ownerBox,
			i;

		if ( $root === UNDEFINED ) {  // user api call
			// 'deactivate' everything (except popups and cyclers)

			i = items.length;
			while ( i-- ) {
				if ( ( $link = items[ i ] && items[ i ].hostEl ) ) {
					$link.fbx = $link.tip = UNDEFINED;
					removeEvent( $link, [
							'touchend',
							'click',
							'contextmenu',
							'mouseover',
							'mouseout'
						],
						contipHandler
					);
				}
			}
			items.length = 0;
		}

		ownerBox = getOwnerInstance( $root );
		if ( $root !== FALSE ) {  // not coreInit's initial call
			fbActivate( $root, ownerBox );  // .floatboxClass stuff
		}
		contipActivate( getByClass( [ contextClass, tooltipClass ], $root ), ownerBox );
		popupActivate( select( 'a[class*="fbPop"]', $root ), ownerBox );
		cyclerActivate( getByClass( cyclerClass, $root ) );
	}  // activate


	function getFormValues ( $form ) {
		$form = document.forms[ $form ] || $( $form );
		// Build object from Form fields.
		// www.w3.org/TR/html401/interact/forms.html
		var
			rtn = {},
			radioDone = {},
			elements,
			$el,
			name,
			value,
			tagName,
			type,
			members,
			$member,
			layout,
			i, j;

		if ( getTagName( $form, 'form' ) ) {

			elements = select( '*', $form );  // $form.elements does not include image inputs
			for ( i = 0; i < elements.length; i++ ) {
				$el = elements[ i ];
				if ( ( name = !$el.disabled && $el.name ) ) {
					// nameless and disabled elements never get submitted

					value = $el.value;
					tagName = getTagName( $el );
					type = ( attr( $el, 'type' ) || '' ).toLowerCase();
					layout = 0;

					if ( tapDetails.eType && nodeContains( $el, tapDetails.tapTarget ) ) {
						if ( type == 'image' ) {
							layout = tapDetails.eType == 'keydown'
								? objectify( tapDetails.tapX, tapDetails.tapY )
								: simpleLayout( $el );
							// for .x and .y calculations
						}
						tagName = type = 'input';  // let used submit and image elements through
					}

					// all input
					if ( tagName == 'input' ) {
						if ( [ 'file', 'image', 'reset', 'submit' ].indexOf( type ) < 0 ) {  // ignore these
							// input: radio
							// processed as a set
							if ( type == 'radio' ) {
								if ( radioDone[ name ] ) {
									name = NULL;
								}
								else {

									radioDone[ name ] = TRUE;
									value = NULL;
									members = select( 'input' + '[name="' + name + '"]', $form );

									j = members.length;
									while ( !value && j-- ) {
										if ( members[ j ].checked ) {
											value = members[ j ].value;
										}
									}

									if ( !value ) {
										name = NULL;  // no radio buttons were checked
									}
								}
							}

							// input: checkbox
							else if ( type == 'checkbox' ) {
								if ( $el.checked ) {
									value = value || 'on';
								}
								else {
									name = NULL;
								}
							}

							// input: the above + text, password, hidden, & arbitrary type
							if ( name ) {
								if ( layout ) {  // image coords
									rtn[ name + '.x' ] = mathCeil( tapDetails.tapX - layout.left );
									rtn[ name + '.y' ] = mathCeil( tapDetails.tapY - layout.top );
								}
								else {
									multiAssign( rtn, name, value );
								}
							}
						}
					}

					// select
					else if ( tagName == 'select' ) {

						members = select( 'option', $el );  // option elements in this select
						for ( j = 0; j < members.length; j++ ) {
							$member = members[ j ];

							if ( $member.selected ) {
								multiAssign( rtn, name,
									attr( $member, 'value' ) !== NULL ? $member.value : $member.text
								);
							}
						}
					}

					// textarea
					else if ( tagName == 'textarea' ) {
						rtn[ name ] = value;
					}
				}
			}
		}
		return rtn;
	}  // getFormValues


	function getLayout ( $node, local ) {
		// See simpleLayout for details.
		// Adds objects of margin, border and padding values to simpleLayout results.
		$node = $( $node );
		var
			rtn = simpleLayout( $node, local ),
			sides = [ 'left', 'bottom', 'right', 'top' ],
			things = objectify(
				'padding', '',
				'border', 'Width',
				'margin', ''
			),
			thing,
			i;

		for ( thing in things ) {
			rtn[ thing ] = {};
			i = sides.length;
			while ( i-- ) {
				rtn[ thing ][ sides[ i ] ] =
					getStyle( $node,
						thing + '-' + sides[ i ] + things[ thing ],
						TRUE
					);
			}
		}
		return rtn;
	}  // getLayout


	function getViewport ( win ) {
		// CSS { left, top, width, height } of the visual portal.
		win = win || topWin;
		var
			$docEl = win.document.documentElement,
			vvp = win.visualViewport,
			rtn;
		rtn = objectify( vvp ? [ vvp.pageLeft, vvp.pageTop, vvp.width, vvp.height ]
			: [
				win.pageXOffset || 0,
				win.pageYOffset || 0,
				mathMin(
					$docEl.clientWidth || bigNumber,
					win.innerWidth || bigNumber
				),
				mathMin(
					$docEl.clientHeight || bigNumber,
					win.innerHeight || bigNumber
				)
			]
		);

		return rtn;
	}  // getViewport


	function getStyle ( $el, name, numeric ) {
		// Returns getComputedStyle for css settings in effect.
		var
			rtn,
			objStyle,
			rules,
			val;

		if ( ( $el = $( $el ) ) ) {

			objStyle = self.getComputedStyle;
			objStyle = objStyle && getTagName( $el )
				? objStyle( $el )
				: $el.style;  // object with a style property, canvas animation uses this
			if ( objStyle ) {

				if ( name ) {
					rtn = objStyle[ camelCase( name ) ];
					if ( numeric ) {
						rtn = getFloat( rtn );
					}
				}

				else {
					// no property passed, return string of all rules assigned to this node
					// emulate cssText which doesn't work in Firefox and IE

					rtn = objStyle.cssText || '';  // webkit, edge, maybe others over time

					if ( !rtn ) {
						rules = {};
						for ( name in objStyle ) {
							val =
								/[a-z]/i.test( name )  // ignore numbered
								&& [ 'cssText', 'length' ].indexOf( name ) < 0  // ignore meta
								&& objStyle[ name ];

							// interested only in set scalar values, not functions, empty strings etc.
							if ( ''+val === val && val || +val === val ) {
								rules[ camelCase( name, TRUE ) ] = val;
								// firefox includes both camel and css names
							}
						}
						for ( name in rules ) {
							rtn += name + ':' + rules[ name ] + ';';
						}
					}

					// vendor-prefixed styles can cause problems when transferred to different elements
					rtn = patch( rtn, /-?(webkit|ms|moz)-[^;]+;/g, '' );
				}
			}
		}
		return rtn;
	}  // getStyle


	function setStyle ( $el, prop, val ) {
		// Set one or more styles on one or more elements,
		// handling various vagaries and special requirements.
		// arg1 and arg2 can be scalars of 'name' & 'value',
		// or arrays or objects of name/value pairings.
		$el = $( $el ) || select( $el );
		var
			$style,
			i;

		if ( isArray( $el ) ) {  // iterate multiple targets
			i = $el.length;
			while ( i-- ) {
				setStyle( $el[ i ], prop, val );
			}
		}

		else if ( ( $style = $el && $el.style ) ) {  // process one target

			if ( ''+prop === prop ) {  // scalar string property

				if ( +val === val ) {  // pixel values can be sent as numeric values
					val += prop == 'opacity' || prop == 'zIndex' ? '' : 'px';
				}
				val = val ? '' + val : '';  // stringify
				$style[ prop ] = val;
				if ( prop == 'overflow' ) {  // Edge and IE don't expand the overflow style
					$style.overflowX = $style.overflowY = val;
				}
			}

			else {  // an array or object of prop:val pairs
				val = extend( {},
					objectify( prop ),
					objectify( val )  // allow second name:val obj or arr, for internal use
				);
				for ( prop in val ) {
					setStyle( $el, prop, val[ prop ] );
				}
			}
		}
	}  // setStyle


	function getInstance ( name, modal ) {
		// Return box instance requested by name
		// or top-most box instance if 'name' is not provided.
		var
			maxOrder = -1,
			rtn,
			instance,
			i;

		i = instances.length;
		while ( i-- ) {
			instance = instances[ i ];
			if ( instance && instance.state ) {
				if ( name ) {
					if ( instance.name == name ) {
						rtn = instance;
					}
				}
				else if ( instance.stackOrder > maxOrder ) {
					maxOrder = instance.stackOrder;
					rtn = instance;
				}
			}
		}

		return ( rtn && modal && !rtn.isModal ? NULL : rtn );
	}  // getInstance


	function getOwnerInstance ( $node ) {
		// Return box instance that contains this node (or undefined).
		var
			instance,
			win,
			i;

		i = instances.length;
		while ( i-- ) {
			instance = instances[ i ];
			if ( instance && instance.state ) {
				win = instance.fbContent && instance.fbContent.contentWindow;  // if it's an iframe
				// find a direct descendant of an existing box, or in an iframe inside this box
				if ( nodeContains( instance.fbMain, $node )  // the box or a direct descendant
					|| $node == win  // the window object in an iframe (may be x-domain)
					|| getOwnerWindow( $node ) == win  // won't match x-domain elements
				) {
					return instance;
				}
			}
		}
	}  // getOwnerInstance


	function nodeContains ( $host, $guest ) {
		// Boolean: $host.contains( $guest ).
		// Will move document requests to the html element and will recurse iframes.
		$host = $( $host );
		$guest = $( $guest );
		var
			hostWin = getOwnerWindow( $host ),
			guestWin = getOwnerWindow( $guest ),
			rtn;

		if ( hostWin && guestWin ) {

			// change document references to the html element
			// (ie doesn't have .contains on the document)
			$host = $host.documentElement || $host;
			$guest = $guest.documentElement || $guest;

			if ( !getTagName( $guest ) ) {  // maybe a text node
				$guest = $guest.parentElement;
			}

			rtn = guestWin == hostWin ? $host.contains( $guest )
				: nodeContains( $host, guestWin.frameElement );  // check inside an iframe
		}
		return rtn;
	}  // nodeContains


	function printNode ( $node, printCSS, activeSettings ) {
		// Copy an element into a new window and fire up the new window's print dialog.
		$node = $( $node ) || {};
		var
			styles = '',
			content = $node.outerHTML,
			isIframe = getTagName( $node, 'iframe' ),
			doc = getOwnerWindow(  // does the x-domain checking
				isIframe ? $node.contentWindow : $node,
				'document'
			),
			// new window will be the same size as the source node
			// except for Webkit's embedded dialog that resides inside the new window
			pos = isWebkit
				? objectify( 'width', 815, 'height', 745 )
				: simpleLayout( $node ),
			printWindow,  // for printDialog
			bodyStyle,
			base,
			script,
			$styleNodes,
			i;

		data.printDialog = function () {
			printWindow = this;  // the print window global object

			// show the print dialog
			printWindow.document.body.focus();
			if ( trigger( activeSettings.beforePrint, printWindow ) !== FALSE ) {
				setTimer( function () {  // presto needed a new thread, maybe safer for others too
					printWindow.print();
					printWindow.close();
				} );
			}
		};

		if ( doc ) {

			if ( isIframe ) {
				$node = doc.body;  // the iframe body is our node to print
				content = $node.innerHTML;
				bodyStyle = attr( $node, 'style' );
				bodyStyle = bodyStyle && bodyStyle.cssText || bodyStyle;
			}

			// add a <base /> element so relative references will keep working in the new window
			base = makeOuterHtml( 'base', FALSE, [ 'href', topUrl.base ] );

			// remove scripts and add body element style attribute
			content = makeOuterHtml( 'body',
				patch( content, /<script[^>]*>([\s\S]*?)<\/script>/gi, '' ),
				[ 'style', bodyStyle ]
			);

			// new window's onload function
			script = makeOuterHtml( 'script',
				'opener.fb.addEvent(self,"load",opener.fb.data.printDialog)'
			);

			// get linked stylesheets and inline style definitions
			$styleNodes = select( [ 'link', 'style' ], doc );
			for ( i = 0; i < $styleNodes.length; i++ ) {
				styles += $styleNodes[ i ].outerHTML;
			}
			// followed by plain styling enforcement
			styles +=
				makeOuterHtml( 'style',
					'html,body{border:0;margin:0;padding:0}'
					+ ( isIframe ? 'html' : 'body' )
					+ '{background:'
					+ getStyle( $node.parentElement, 'backgroundColor' )  // overrides background-image
					+ '}'
				);

			// optional passed param "printCSS" can be a css file path or a string of style definitions
			if ( printCSS ) {
				if ( /\.css(\?|$)/i.test( printCSS ) ) {
					styles += makeOuterHtml( 'link', FALSE, [
						'rel', 'stylesheet',
						'href', printCSS
					] );
				}
				else {
					styles += makeOuterHtml( 'style', printCSS );
				}
			}

			// print from a new browser window
			newWindow(
				makeOuterHtml( 'head', base + styles + script ) + content,
				TRUE,
				'width=' + pos.width + ',height=' + pos.height
			);
		}
	}  // printNode


	function getByClass ( classes, $node, nth ) {
		classes = classes || '';
		// Select by class, legacy-ish function largely superceded by fb.select.

		// an array of class names will match any (or'd together)
		if ( isArray( classes ) ) {
			classes = classes.join( ',.' );
		}

		// a string class name must match all of them (and'd together)
		else {
			classes = patch( classes, /\s+/g, '.' );
		}

		return select( '.' + classes, $node, nth );
	}  // getByClass


	function parseJSON ( str ) {
		// Objectify a JSON string.
		// Fail returns undefined.

		try {
			return self.JSON.parse( str );
		}
		catch ( _ ) { }
	}  // parseJSON


	function start ( source, apiSettings ) {
		// All floatboxes, including tooltips and contexts, start life here.
		apiSettings = parseOptions( apiSettings );  // to object
		source = source ? items[ source.fbx ] || source : apiSettings.source;
		var
			startItem,
			startSettings,
			boxContent,
			firstSource,
			topBox,
			sameBox,
			instance,
			item,
			alreadyShowing,
			i;

		if ( source ) {

			if ( !isArray( source ) ) {
				source = [ source ];
			}
			i = source.length;
			while ( i-- ) {
				// iterate down to the first one, but activate the others along the way
				if ( ( firstSource = source[ i ] ) ) {
					startItem = firstSource.boxContent ? firstSource
						: activateItem( firstSource, TRUE, apiSettings );
						// true tells getCurrentSet to assign ownerBox
				}
			}

			if ( ( boxContent = startItem && startItem.boxContent ) ) {
				// copy startItem's settings so the original won't get modified
				startSettings = extend( {},
					startItem.itemSettings,
					apiSettings
				);

				// look for a showable item if showThis is false
				if ( !startItem.canShow ) {
					i = items.length;
					while ( i--
						&& !( startItem.canShow && startItem.boxContent == boxContent )
					) {
						item = items[ i ];
						if ( item && item.itemSettings.group == startSettings.group ) {
							// keep assigning group members until we reach a
							// matching showable item or the first member
							startItem = item;
						}
					}

					// options on the showThis:false item take precedence
					extend( startSettings, startItem.itemSettings, firstSource.itemSettings );
				}

				// open content in a new window if requested, most commonly set in mobile options
				if ( startSettings.newWindow ) {
					newWindow( startItem.isUrl ? boxContent  // open urls directly
						: makeOuterHtml( 'body',  // write inline or direct html to the new document
							startItem.isInline ? $( boxContent ) : boxContent
						)
					);
				}

				else {  // normal show in a box

					if ( ( topBox = getInstance() ) ) {  // there's an existing open box

						// if siblings and trying to start an already-open item,
						// just move that item to the top
						if ( !topBox.isModal ) {
							i = instances.length;
							while ( i-- ) {
								instance = instances[ i ];
								item = instance && instance.activeItem;
								if ( item
									&& !instance.isModal
									&& item.boxContent == boxContent
									&& item.hostEl == startItem.hostEl
								) {
									instance.restack();
									alreadyShowing = TRUE;  // don't boot
								}
							}
						}

						// check for a sameBox load request
						sameBox = startSettings.sameBox
							&& topBox.activeItem
							&& !topBox.activeItem.isContip;  // can't re-use a context or tooltip
					}

					if ( !alreadyShowing ) {
						if ( !sameBox ) {
							topBox = newBox( startSettings.modal !== FALSE );
						}
						// give the document mousedown handler time to capture click coords
						setTimer( [ topBox.boot, sameBox, startItem, startSettings ] );
					}
				}
			}
		}
	}  // start


	function ajax ( source, params ) {
		// A clean interface to the XMLHttpRequest object.
		// source: required string url of file to be fetched.
		// params:
		//   $:  node or id to set innerHTML
		//   postData:  data to be posted - querystring, js object, or form node, id, or name
		//   success(result):  function - receives extended xhr object as its only passed parameter
		//   failure(result):  function - receives extended xhr object as its only passed parameter
		//   finish(result):  completion callback - fires whether the request was successful or not
		//   headers:  {object} of name:value pairs of custom request headers
		//   cacheable:  boolean - defaults to true, allowing browsers to cache results
		//   timeout:  abort after timeout milliseconds (finish will fire with result.status === 0)
		//   source: legacy, earlier versions used a 'source' params property (also aliased as 'url')
		if ( typeOf( source, 'object' ) ) {  // allow a single object argument
			params = source;
			source = params.source || params.url;
		}
		params = params || {};
		var
			xhr = 'XMLHttpRequest',
			onDone = params.failure,
			postData = params.postData,
			headers = params.headers || {},
			$updateNode = $( params.$ || params.updateNode ),  // .updateNode is legacy syntax
			header;

		try {

			source = parseUrl( source,
				params.cacheable === FALSE && { no_cache: now() }  // perhaps modify the query string
			);
			if ( source.host == topUrl.host ) {
				headers[ 'X-Requested-With' ] = xhr;
			}

			if ( postData ) {
				postData = serialize( postData ) || postData;  // can be a form, object or string
				headers[ 'Content-Type' ] = 'application/x-www-form-urlencoded';
			}

			xhr = new self[ xhr ]();
			xhr.open( postData ? 'POST' : 'GET', source.fullUrl );

			for ( header in headers ) {
				xhr.setRequestHeader( header, headers[ header ] );
			}

			if ( params.timeout ) {  // set a requested abort timeout
				setTimer( xhr.abort, +params.timeout, source.fullUrl );
			}

			xhr.onreadystatechange = function () {
				var
					result = {},
					status;

				if ( xhr.readyState == 4 ) {

					clearTimer( source.fullUrl );  // abort pending abort
					extend( result, xhr, { responseJSON: parseJSON( xhr.responseText ) } );
					status = result.status;

					if ( /^2|304/.test( status ) ) {
						if ( getTagName( $updateNode ) ) {
							setContent( $updateNode, result.responseText, TRUE );
							activate( $updateNode );
						}
						onDone = params.success;
					}

					trigger( status && onDone, result );  // status == 0 if abort was called
					trigger( params.finish || params.callback, result );
					// finish always runs - on success, failure and abort (.callback is legacy)
				}
			};

			xhr.send( postData );
		}

		catch ( _ ) {
			trigger( onDone, xhr );  // onDone will still be params.failure
		}
	}  // ajax


	function animate ( props, then, duration, inflection, easing, monitor ) {
		// CSS animated transitions, with canvas assistance for cyclers
		// 'props' is an array of objects containing mandatory $:domElem(s)
		//  and any number of propName:cssVal entries
		duration = +duration === duration ? duration
			: ifNotSet( baseSettings.animationTime, 1 );  // default animation time
		inflection = +inflection === inflection ? inflection
			: ifNotSet( baseSettings.inflection, 0.5 );  // default easing inflection point
		easing = +easing === easing ? easing
			: ifNotSet( baseSettings.easing, 2.5 );  // default easing strength
		var
			monitorIsFunction = typeOf( monitor, 'function' ),
			status = !monitor || monitorIsFunction ? {} : monitor,
			// scale the acceleration curve prior to the inflection point
			easeScale1 = inflection / mathPow( inflection, easing ) || 1,
			// and after
			easeScale2 = ( 1 - inflection ) / mathPow( 1 - inflection, easing ) || 1,
			maxDiff = 0,
			requests = [],
			$els,
			$el,
			descriptor,
			startVal,
			delta,
			name,
			val,
			startTime,
			thisTime,
			lastTime,
			i, j;

		function step () {
		// apply requested values for this increment and set timer request for next increment
			var
				easeStep,
				canvasInfo,
				fraction,
				i;

			if ( monitorIsFunction ) {
				monitor( status );
			}

			thisTime = now();
			if ( !startTime ) {
				startTime = lastTime = thisTime - 7;
				// -7 because there's no point wasting this first pass by drawing a zero increment
			}

			canvasInfo = {};
			fraction = mathMin( 1,  // don't go past the end values
				duration ? mathMax( status.step, ( thisTime - startTime ) / duration ) : 1
				// check status.step for a mid-flight jump to completion
			);

			// set a request or timer for the next iteration
			if ( fraction < 1 ) {
				( self.requestAnimationFrame || setTimer )( step );  // only IE9 needs the timer
			}

			// allow caller to suspend animation by setting status.active=falsey
			if ( fraction < 1 && ( document.hidden || !status.active ) ) {
				startTime += thisTime - lastTime;  // adjust startTime so we resume at the same step
			}

		// draw this step
			else {

				status.step = fraction;
				easeStep = easing == 1
					? fraction  // faster if not easing
					: fraction < inflection
					? easeScale1 * mathPow( fraction, easing )  // easing formula
					: 1 - easeScale2 * mathPow( 1 - fraction, easing );  // reverse easing formula

				for ( i = 0; i < requests.length; i++ ) {
					var
						request = requests[ i ],
						$el = request[ 0 ],
						prop = request[ 1 ],
						startVal = request[ 2 ],
						delta = request[ 3 ];

					// canvas from fbCycler
					if ( $el.canvas ) {

						// use compound interest formula to zoom as a steady % of interim size
						// (not used because it's detectable only on ridiculously large zooms)
						// M = P( 1 + i )^n
						// currentVal = startVal( 1 + delta/startVal )^currentFraction

						// gather property values for subsequent all-at-once drawing
						canvasInfo.$ = $el;  // the 2d context
						canvasInfo[ prop ] = startVal + delta * easeStep;
					}

					// standard css animate request
					else {
						setStyle( $el, prop,
							startVal + delta * ( prop == 'opacity' ? fraction : easeStep )
						);
					}
				}

			// draw a canvas image if requested
				descriptor = canvasInfo.$;
				if ( descriptor && descriptor.img && descriptor.img.src ) {
					descriptor.drawImage(
						descriptor.img,
						canvasInfo.left,
						canvasInfo.top,
						canvasInfo.width,
						canvasInfo.height
					);
				}
			}

			lastTime = thisTime;  // for next time

			if ( fraction >= 1 ) {  // we're done
				status.active = FALSE;
				status.step = 1;
				trigger( then );
			}
		}  // step;

		// unpack the arguments
		if ( !isArray( props ) ) {
			// can accept a singleton descriptor object
			props = [ props ];
		}
		for ( i = 0; i < props.length; i++ ) {

			// accept incoming requests as arrays to make code more minifiable
			descriptor = objectify( props[ i ] );

			// $ param can be node ref, node id, array of node refs and ids, or a selector string
			if ( ( $els = $( descriptor.$ ) || select( descriptor.$ ) ) ) {
				if ( !isArray( $els ) ) {
					$els = [ $els ];
				}

				// capture arrays of [ node, property, startVal, delta ]
				for ( name in descriptor ) {
					if ( name != '$' ) {

						for ( j = 0; j < $els.length; j++ ) {
							if ( ( $el = $( $els[ j ] ) ) ) {

								val = descriptor[ name ];
								startVal = getStyle( $el, name, TRUE );
								delta = val - startVal;

								maxDiff = mathMax( maxDiff,
									mathAbs( delta ) * ( name == 'opacity' ? 700 : 1 )
									// opacity changes use requested duration
								);
								requests.push( [  // one array for each property to be set
									$el,
									camelCase( name ),
									startVal,
									delta
								] );
							}
						}
					}
				}
			}
		}

		// scale animation duration given as seconds to the magnitude of change
		// (scale of 1 at 700px)
		duration = getFloat( duration );
		if ( duration < 77 ) {  // >= 77 assumed to be exact msec request
			duration *= 999 * mathPow( mathMin( maxDiff, 1500 ) / 700, 0.5 );  // msecs
		}

		// initialize monitor status and start animating
		status.step = 0;
		status.active = TRUE;
		step();
	}  // animate


	function preload ( source, then ) {
		// Preload/cache images
		var
			path404 = resourcesFolder + '404.png',
			imgs = [],  // starts off with "path"s, then <img src="path">
			src,
			i;

		function fetch ( idx, src ) {
			var
				isComplete,
				i;

			function onLoadOrError ( e ) {
				var
					$img = this,
					img404 = $img.src.indexOf( path404 ) > -1;

				// success
				if ( e.type == 'load' || img404 ) {  // don't retry if the 404 image 404'd too
					$img.ok = !img404;
					$img.onload = $img.onerror = NULL;
					preloads[ src ] = $img;
					fetch( idx, src );  // check for completion of this request
				}

				// failure
				else {
					attr( $img, objectify(  // remove broken-image dims
						'width', NULL,
						'height', NULL
					) );
					$img.src = path404;
				}
			}  // onLoadError

			// get previously cached img from our preloads object
			if ( preloads[ src ] ) {
				imgs[ idx ] = preloads[ src ];

				// check if all images in this request array have been fetched
				isComplete = TRUE;
				i = imgs.length;
				while ( i-- ) {
					isComplete = isComplete && typeOf( imgs[ i ].ok, 'boolean' );
				}

				// run the callback when all images are ready
				if ( isComplete ) {
					trigger( isArray( then ) ? then
						: [ then, imgs[ 1 ] ? imgs : imgs[ 0 ] ]  // call with array if more than one img
					);
				}
			}

			// not previously fetched, go get it
			else {
				imgs[ idx ] = newElement( 'img' );
				imgs[ idx ].onload = imgs[ idx ].onerror = onLoadOrError;
				imgs[ idx ].src = src;  // initiate network fetch
			}
		}  // fetch

		// start with an array
		if ( !isArray( source ) ) {
			source = [ source ];
		}

		// build local array of requested src paths (maybe from an existing <img>'s src param)
		for ( i = 0 ; i < source.length; i++ ) {  // original order for callback param
			src = source[ i ];
			if ( src ) {
				imgs.push( src.src || src );
			}
		}

		// run the callback for empty source request
		if ( !imgs.length ) {
			trigger( then );
		}

		// fetch info from the global preloads object or the img from the network if not yet cached
		for ( i = 0; i < imgs.length; i++ ) {
			fetch( i, imgs[ i ] );
		}
	}  // preload

///  end api functions

///  begin internal functions

	function activateItem ( boxContent, ownerBox, apiSettings ) {
		// Determine content type, add to items array, and look for autoStart.
		// 'boxContent' may be <a> or <area> link, strHref, str#HiddenDivId or strHtml,
		// (always a link when called from activate).
		apiSettings = apiSettings || {};
		var
			itemSettings = {},  // aggregate of all settings - base, type, subtype, class, link, api
			linkSettings = {},
			itemTypeSettings = {},
			itemClassSettings = {},
			item = {
				captions: [],  // assigned by fetchContent (includes header and footer)
				wrapperDivs: []  // for captions that come from hidden divs
			},
			tagName,
			$link,
			contentType,
			subType,
			url,
			boxName,
			$thumb,
			$el,
			$parent,
			classNames,
			setting,
			i;

		// parse out a $link, normally a clicked one
		tagName = getTagName( boxContent, [ 'a', 'area' ] );
		if ( ( $link = tagName && boxContent ) ) {
			$thumb = tagName == 'a' ? select( 'img', $link, 0 ) : $link;
			linkSettings = parseOptions( $link );
			addClass( linkSettings, getClass( $link ) );
			boxContent = $link.parentElement && $link.href;  // ensure link is still attached
		}

		// gather all the assigned classNames
		// inherited ones were pushed to the link's options by activate
		addClass( itemSettings, [
			linkSettings.className,
			apiSettings.className,
			baseSettings.className,
		] );

		// and classSettings
		classNames = ( itemSettings.className || '' ).split( ' ' );
		i = classNames.length;
		while ( i-- ) {  // precedence to first listed classes (ltr)
			extend( itemClassSettings, classSettings[ classNames[ i ] ] );
		}

		// build preliminary itemSettings so we can determine type and finalize boxContent
		extend( itemSettings,
			baseSettings,
			parseOptions( apiSettings.contipSettings || attr( $link, 'data-fb' ) ),
			itemClassSettings,
			linkSettings,
			apiSettings
		);

		if ( ( boxContent = itemSettings.source || boxContent ) ) {

			// figure out content type (and maybe update boxContent)
			contentType = itemSettings.type;  // may be corrected

			// direct html content
			if ( /<.+>/.test( boxContent ) ) {
				boxContent = makeOuterHtml( 'div', boxContent );
				contentType = 'direct';
			}

			else {

				// absolutize the boxContent url and capture some path info
				url = parseUrl( decodeHTML( boxContent ) );

				// hidden div content
				if ( $( url.hash ) ) {
					boxContent = url.hash;
					boxName = patch( boxContent, '#', '' );
					contentType = 'inline';
				}

				// type based on file path
				else {

					boxName = url.fileName;
					boxContent = url.fullUrl;
					contentType = contentType || url.fileType;

					// capture cross-site status while we're looking
					item.isXSite = contentType == 'pdf' || url.host != topUrl.host;
					// includes pdf because it can't be measured
				}
			}

			// sort out main and sub-types
			subType = contentType;
			if ( [ 'inline', 'ajax', 'direct', 'pdf' ].indexOf( subType ) > -1 ) {
				contentType = 'html';
			}
			else if ( contentType != 'image' && contentType != 'video' ) {
				subType = 'iframe';  // default type
				contentType = 'html';
				if ( !item.isXSite ) {
					boxContent = url.noHash;  // drop the hash so webkit won't scroll the base page too
					item.scrollHash = url.hash;
				}
			}

			// determine type settings
			extend( itemTypeSettings,
				typeSettings[ contentType ],
				typeSettings[ subType ]
			);

			// redo class settings for any new classNames assigned by type or other className options
			addClass( itemSettings, [
				itemTypeSettings.className,
				itemClassSettings.className
			] );
			classNames = ( itemSettings.className || '' ).split( ' ' );
			i = classNames.length;
			while ( i-- ) {
				extend( itemClassSettings, classSettings[ classNames[ i ] ] );
			}

			// finalize itemSettings (base, contip and inherited settings retained from above)
			extend(
				itemSettings,
				itemTypeSettings,
				itemClassSettings,
				linkSettings,
				apiSettings
			);

			// capture various item details
			extend( item, {
				boxContent: boxContent,
				itemSettings: itemSettings,
				canShow: itemSettings.showThis !== FALSE,
				boxName: boxName || '',
				ownerBox: ownerBox || getOwnerInstance( $link ),
				hostEl: $link,
				thumbEl: $thumb,
				playButton: itemSettings.addPlayButton,
				isImage: contentType == 'image',
				isHtml: contentType == 'html',
				isVideo: contentType == 'video',
				isInline: subType == 'inline',
				isAjax: subType == 'ajax',
				isDirect: subType == 'direct',
				isIframe: [ 'iframe', 'video', 'pdf' ].indexOf( subType ) > -1,
				isUrl: subType != 'inline' && subType != 'direct'
			} );

			setting = attr( $thumb, 'data-fb-src' );  // pending src attribute in cycler sets
			item.thumbSrc = setting != 'src' && setting || $thumb && $thumb.src;

			// remove autoGallery group from non-images
			if ( itemSettings.group == 'autoGallery' && !item.isImage ) {
				itemSettings.group = NULL;
			}

			// handle titleAsCaption and altAsCaption
			setting = itemSettings.titleAsCaption;
			itemSettings.caption = ifNotSet( itemSettings.caption,
				setting !== FALSE
				&& (
					setting != 'img' && attr( $link, 'title' )
					|| setting != 'a' && attr( $thumb, 'title' )
				)
				|| itemSettings.altAsCaption && attr( $thumb, 'alt' )
			);

			// queue images for preloading
			if ( item.isImage && preloadLimit ) {
				preloadLimit--;
				setTimer( [ preload, boxContent ] );
			}

			// prep video links requests
			if ( item.isVideo ) {
				videoPrep( item );  // will call videoAddThumb and videoAddPlay
			}
			else if ( item.playButton ) {
				videoAddPlay( item );
			}

			// wrap hidden divs in another div and save the wrapper so we can put the content back
			if ( item.isInline ) {

				if ( ( $el = $( boxContent ) ) ) {
					$parent = $el.parentElement;
					item.contentWrapper = $parent && $parent.fbName == 'fbContent'
						// already showing in a box?
						? getOwnerInstance( $parent ).activeItem.contentWrapper
						: wrapElement( $el );
				}

				else {
					item = NULL;  // can't find it to show it
				}
			}

			if ( item ) {

				if ( $link && ownerBox !== TRUE ) {  // not api start

					setting = topUrl.query.autoStart;
					if ( setting && item.canShow && boxContent.indexOf( setting ) > -1
						|| !showAtLoad && itemSettings.autoStart
					) {
						showAtLoad = item;
					}
					addEvent( $link, 'onclick', clickHandler );
					$link.fbx = items.length;  // put index on the link expando so start can find it

					if ( itemSettings.showMagCursor ) {
						setStyle( $link, 'cursor', zoomInCursor );
					}
				}

				items.push( item );
			}

			return item;
		}
	}  // activateItem


	function clickHandler ( e ) {
		// Standard floatbox link click-launcher

		if ( !( e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ) ) {
			stopEvent( e );
			if ( tapDetails.eType ) {
				start( this );
			}
		}
	}  // clickHandler


	function wrapElement ( $el, type ) {
		// Wrap an element in another one, and return the wrapper
		var
			$parent,
			$wrapper,
			display,
			visibility;

		if ( ( $parent = $el && $el.parentElement ) ) {

			if ( hasClass( $parent, 'fbWrapper' ) ) {  // already wrapped?
				$wrapper = $parent;
			}

			else {
				$wrapper = newElement( type || 'div' );
				addClass( $wrapper, 'fbWrapper' );
				$parent.replaceChild( $wrapper, $el );
				placeElement( $el, $wrapper );

				if ( !type ) {
					// transfer display and visibility to the wrapper node

					display = getStyle( $el, 'display' );
					visibility = getStyle( $el, 'visibility' );

					setStyle( $wrapper, [
						'display', display,
						'visibility', visibility,
						'width', '100%',  // width and height helps some layouts when $el is visible
						'height', '100%'
					] );

					setStyle( $el, [  // make node visible when transferred out of the wrapper
						'display', display == 'none' ? 'inline-block' : display,
						'visibility', 'inherit'
					] );
				}
			}
		}

		return $wrapper;
	}  // wrapElement


	function tapHandler ( e ) {
		// User input monitoring.
		// Sets global tapDetails object as follows:
		//   eType: 'touchstart' | 'mousedown' | 'keydown'
		//   tapTarget: used only by getFormValues
		//   tapX: clientX
		//   tapY: clientY
		// Also keeps fb.usingTouch current.

		if ( !e ) {
			// cancelled by timer (tap held down too long),
			// multi-touch, or by code as a stopEvent cheater
			tapDetails.eType = NULL;
		}
		else {
			var
				eType = e.type,
				tap = e.changedTouches && e.changedTouches[ 0 ] || e,
				$target = tap.target,
				owner = getOwnerWindow( $target ) || topWin,
				clientX = tap.clientX,
				clientY = tap.clientY,
				keyCode = tap.keyCode,
				metrics,
				instance,
				tapX,
				tapY,
				i;

			// ignore scrollbar clicks
			if ( $target == document.documentElement ) {
				eType = NULL;
			}

			// adjust client coords for mobile screen zoom and/or containing iframe
			if ( +clientX === clientX ) {
				if ( owner == topWin ) {
					clientX -= clientOffset.left;
					clientY -= clientOffset.top;
				}
				else {  // tapped in a frame
					metrics = simpleLayout( owner.frameElement );
					clientX += metrics.left;
					clientY += metrics.top;
				}
			}

			if ( eType == 'touchstart' || eType == 'mousedown' && !tapDetails.eType ) {
				// ignore psuedo mousedown following a touchstart event

				fb.usingTouch = usingTouch = eType == 'touchstart';
				// must set it each time to support hybrid devices using both touch and mouse

				if ( usingTouch ) {
					if ( e.touches[ 1 ] ) {  // multi-touch
						tapHandler();  // cancel tap
					}
					else {
						tapX = clientX;
						tapY = clientY;
						if ( clientY && !tap.pageY ) {
							// some (old?) mobile browsers lack pageX/Y but put doc coords in clientX/Y
							metrics = getViewport( owner );
							tapX -= metrics.left;
							tapY -= metrics.top;
						}
					}
				}

				else if ( !tap.button ) {  // mousedown left click
					tapX = clientX;
					tapY = clientY;
				}
			}

			else if ( eType == 'keydown'
				&& ( keyCode == 13 || keyCode == 27 || keyCode == 32 )  // enter,esc,space
			) {
				metrics = simpleLayout( $target );
				tapX = metrics.x;
				tapY = metrics.y;
			}

			else if ( eType == 'touchend' || eType == 'mouseup' && !usingTouch ) {

				// cancel tap if user is swiping
				if ( tapDetails.eType ) {
					clientX -= tapDetails.tapX;
					clientY -= tapDetails.tapY;
					if ( clientX * clientX + clientY * clientY > 64 ) {  // moved more than 8px
						tapHandler();
					}
				}

				else if ( usingTouch && !e.touches.length ) {
					// fire viewportHandler at conclusion of two-finger pinch zooms
						viewportHandler();
				}

				// process outsideClickCloses requests
				if ( tapDetails.eType && $target && !tap.button ) {  // ignore middle and right mouse buttons

					popupHideAll( $target );  // close any pop thumbs, except the current target
					owner = getOwnerInstance( $target );
					owner = owner && owner.stackOrder || 0;  // interested only in stackOrder
					i = instances.length;
					while ( i-- ) {  // backwards to stay above the first modal box
						if ( ( instance = instances[ i ] ) ) {

							if ( instance.outerClickCloses || instance.state == STATE_initial ) {
								if ( tapDetails.eType
									&& instance.stackOrder > owner
										// can't close a box by clicking in it or a box above it
									&& !nodeContains( instance.activeItem.hostEl, $target )
										// not on starting link
									|| instance.activeItem.isTooltip && usingTouch
										// touch anywhere for tooltips
								) {
									instance.end();
								}
							}

							if ( instance.isModal ) {
								i = 0;  // don't look underneath modal boxes
							}
						}
					}
				}
			}

			if ( +tapX === tapX ) {

				// don't retain stale click info
				setTimer( tapHandler, 555, TIMER_tap );

				// capture event details
				extend( tapDetails, {
					eType: eType,
					tapTarget: $target,
					tapX: tapX,
					tapY: tapY
				} );
			}
		}
	}  // tapHandler


	function viewportHandler ( e ) {
		// Monitors window scroll and resize changes.
		// Maintains 'global' viewport and virtual screen metrics.
		// Re-centers open boxes.

		// clientOffset:
		//   iOS reports client metrics (getBCR, event.clientX/Y) relative to the visual viewport.
		//   Android reports those same metrics relative to the layout viewport.
		//   Subtract clientOffset values calculated below from the reported client measurements
		//   to get visual viewport position.
		// visualOffset:
		//   Both platforms set css fixed position left and top to the layout, not visual viewport.
		//   Add visualOffset values to visual viewport coordinates to calculate
		//   css left and top of fixed-position elements.
		// The above platform references are likely incomplete and out of date
		// but the calculations below should still be valid as they are based on behaviour.

		if ( e ) {  // from event handler
			setTimer( viewportHandler, 222, TIMER_viewport );  // wait until user has stopped moving
		}

		else {  // from the last timer (or called directly)
			var
				$docEl = topDoc.documentElement,
				metrics,
				$fixedDiv,
				instance,
				settings,
				keepCentered,
				i;

			extend( viewport, getViewport() );  // keep viewport pointing to topData object

			// measure client metrics displacement (android only, iOS will report 0)
			metrics = $docEl.getBoundingClientRect();
			extend( clientOffset, objectify(
				viewport.left + metrics.left - getStyle( $docEl, 'marginLeft', TRUE ),
				viewport.top + metrics.top - getStyle( $docEl, 'marginTop', TRUE )
			) );

			// measure fixed element displacement (iOS only, android will report 0)
			$fixedDiv = newElement( 'div' );
			setStyle( $fixedDiv, [
				'position', 'fixed',
				'left', 0,
				'top', 0
			] );
			placeElement( $fixedDiv, topDoc.body );
			metrics = $fixedDiv.getBoundingClientRect();
			placeElement( $fixedDiv );
			extend( visualOffset, objectify(
				mathMax( -metrics.left, clientOffset.left ),
				mathMax( -metrics.top, clientOffset.top )
			) );

			if ( !previousViewport.width ) {
				extend( previousViewport, viewport );
			}

			if ( mathAbs( previousViewport.width - viewport.width ) > scrollbarSize + 7
				|| mathAbs( previousViewport.left - viewport.left ) > 17
				|| mathAbs( previousViewport.top - viewport.top ) > 17
			) {

				// keepCentered
				i = instances.length;
				while ( i-- ) {
					if ( ( instance = instances[ i ] ) ) {
						settings = instance.activeItem.itemSettings;
						keepCentered = settings.keepCentered;
						if ( instance.state == STATE_show
							&& settings.autoFit !== FALSE
							&& keepCentered !== FALSE
							&& ( keepCentered === TRUE
								|| getStyle( instance.fbMain, 'position' ) != 'fixed'
							)
						) {
							setTimer( instance.resize );
						}
					}
				}

				extend( previousViewport, viewport );
			}
		}
	}  // viewportHandler


	function messageHandler ( e ) {
		// Message handler for video auto-end
		var
			instance = getOwnerInstance( e && e.source ),
			data = instance && parseJSON( e.data ),
			msg;

		if ( data ) {
			msg = data.event;

			// subscribe to vimeo's finish event
			if ( msg == 'ready' ) {
				e.source.postMessage( '{"method":"addEventListener","value":"finish"}', e.origin );
			}

			// look for finished notification
			else if ( msg == 'end' ) {  // esc key from fb.video
				instance.end();
			}
			else if ( msg == 'finish'  // msg from fb and vimeo
				|| data.info && data.info.playerState === 0  // playerState from youtube
			) {
				if ( instance.itemCount == 1 && instance.activeItem.itemSettings.autoEndVideo ) {
					instance.end();
				}
				else if ( instance.isSlideshow ) {
					instance.showItem();
				}
			}
		}
	}  // messageHandler


	function objectify ( arr ) {
		// Returns an object.
		// Will modify array [ 'n1', v1, 'n2', v2 ... ]  to { n1:v1, n2:v2 ... }
		// or build a { $, left, top, width, height } object from array of suitable values.
		var
			rtn = arr,  // reflect objects straight back
			node,
			i;

		if ( !typeOf( rtn, 'object' ) ) {

			// use array or arguments, but don't modify arr
			arr = [].slice.call( isArray( arr ) ? arr : arguments );
			// odd-lengthed arrays have a node reference at [ 0 ]
			if ( arr.length % 2 ) {  // is odd
				node = arr.shift();
			}

			if ( +arr[ 0 ] === arr[ 0 ] || arr[ 0 ] === UNDEFINED ) {
				rtn = objectify(
					'$', node,
					'left', arr[ 0 ],
					'top', arr[ 1 ],
					'width', arr[ 2 ],
					'height', arr[ 3 ]
				);
			}

			else {
				rtn = {};
				arr.push( '$', node );  // might be undefined
				for ( i = 0; i < arr.length; i += 2 ) {
					if ( arr[ i + 1 ] !== UNDEFINED ) {
						rtn[ arr[ i ] ] = arr[ i + 1 ];
					}
				}
			}
		}

		return rtn;
	}  // objectify


	function simpleLayout ( $node, local ) {
		// Returns node's viewport coords.
		//   { left, top, width, height, right, bottom, x, y (center) }.
		// Metrics are for the border-box including padding and border but not margin.
		// Parent iframe offsets will be added in unless local==true.
		$node = $( $node );
		var
			rtn = objectify( zeroes ),
			win = getOwnerWindow( $node ),
			minX = infinity,  // for area polys
			minY = infinity,
			maxX = 0,
			maxY = 0,
			$host,
			rect,
			coords,
			shape,
			x, y, z,
			i;

		if ( win ) {

			if ( getTagName( $node, 'area' ) ) {
				// parse area coordinates relative to the img that is using this area map

				$host = select( 'img[usemap="#' + $node.parentElement.name + '"]', document, 0 );
				if ( $host ) {  // no img, no position

					rtn = getLayout( $host, local );  // img's position and padding/border/margins
					coords = patch( attr( $node, 'coords' ) || '', /\s+/g, '' ).split( ',' );
					x = +coords[ 0 ];
					y = +coords[ 1 ];
					z = +coords[ 2 ];

					// get area bounds [ left, top, right, bottom ]
					shape = attr( $node, 'shape' );
					rect = shape == 'rect' ? [ x, y, z, +coords[ 3 ] ]  // x1,y1,x2,y2
						: shape == 'circle' ? [ x - z, y - z, x + z, y + z ]  // x,y,radius
						: shape == 'default' ? [ 0, 0, rtn.width, rtn.height ]  // the full image
						: 0;

					if ( !rect ) {  // it must be a poly - x1,y1,x2,y2,..,xn,yn

						// find min and max coords
						i = coords.length;
						while ( i-- ) {
							z = +coords[ i ];
							if ( i % 2 ) {  // odd index, y coordinate
								minY = mathMin( minY, z );
								maxY = mathMax( maxY, z );
							}
							else {  // even index, x coordinate
								minX = mathMin( minX, z );
								maxX = mathMax( maxX, z );
							}
						}

						rect = [
							minX == infinity ? 0 : minX,
							minY == infinity ? 0 : minY,
							maxX,
							maxY
						];
					}

					// add padding, border and area coordinates to the img position
					rtn = objectify(
						rtn.left + rtn.border.left + rtn.padding.left + rect[ 0 ],
						rtn.top + rtn.border.top + rtn.padding.top + rect[ 1 ],
						rect[ 2 ] - rect[ 0 ],
						rect[ 3 ] - rect[ 1 ]
					);
					rtn.right = rtn.left + rtn.width;
					rtn.bottom = rtn.top + rtn.height;
				}
			}

			else {  // a dom node, not an area

				extend( rtn,
					$node.getBoundingClientRect()  // DOMRect border-box, read-only
				);
				// adjust from layout to visual viewport
				rtn.left -= clientOffset.left;
				rtn.top -= clientOffset.top;

				// add in containing iframe offset
				$host = !local && win != topWin && win.frameElement;
				if ( $host ) {
					rect = getLayout( $host );
					rtn.left += rect.left
						+ rect.padding.left
						+ rect.border.left
						+ clientOffset.left;  // zoomed screen adjustment
					rtn.top += rect.top
						+ rect.padding.top
						+ rect.border.top
						+ clientOffset.top;
				}
			}
		}

		// add in some redundant metrics
		x = rtn.width / 2;
		y = rtn.height / 2;
		rtn.x = rtn.left + x;
		rtn.y = rtn.top + y;
		rtn.right = rtn.x + x;
		rtn.bottom = rtn.y + y;

		return rtn;
	}  // simpleLayout


	function makeOuterHtml ( name, content, attrs ) {
		// Return html markup for an element.
		var
			rtn = '<' + name,
			i;

		if ( isArray( attrs ) ) {
			for ( i = 0; i < attrs.length; i += 2 ) {
				rtn += ' ' + attrs[ i ] + '="' + encodeHTML( attrs[ i + 1 ] ) + '"';
			}
		}
		rtn += content === FALSE ? '/>' : '>' + ( content || '' ) + '</' + name + '>';
		return rtn;
	}  // makeOuterHtml


	function setContent ( $el, html, runScripts ) {
		// Set innerHTML and optionally run any scripts found in the incoming content.
		var
			scripts,
			i;

		if ( ( $el = $( $el ) ) ) {
			$el.innerHTML = patch( ''+html, /(<script)\b/gi, '$1 type="off"' );
			// invalid type disables execution of scripts

			if ( runScripts ) {
				scripts = select( 'script', $el );
				for ( i = 0; i < scripts.length; i++ ) {
					require( scripts[ i ].src, scripts[ i ].text, TRUE );
				}
			}
		}
	}  // setContent


	function moveElement ( $el, $newParent ) {
		// Moves an element to a new parent element, maybe across different documents.

		if ( $el.ownerDocument != $newParent.ownerDocument ) {
			$newParent.ownerDocument.adoptNode( $el );
		}
		placeElement( $el, $newParent );
	}  // moveElement


	function setBorderRadius ( $el, radius, side, children ) {
		// Set CSS-3 round corners.
		var
			sides = objectify(
				'Top', 'TopLeft',
				'Right', 'TopRight',
				'Bottom', 'BottomRight',
				'Left', 'BottomLeft'
			),
			propName,
			$parent,
			i;

		if ( !side ) {
			for ( side in sides ) {
				setBorderRadius( $el, radius, side, children );
			}
		}

		else {
			propName = 'border' + sides[ side ] + 'Radius';

			if ( radius === UNDEFINED ) {  // get radius from parent, adjusted for border-width
				$parent = $el.parentElement;

				// prefer radius values from style attribute,
				// browsers might have shrunk them to be no larger than the $el
				radius =
					getInt( $parent.style[ propName ] )
					|| getStyle( $parent, propName, TRUE );
				radius -= getStyle( $parent, 'border' + side + 'Width', TRUE );
			}

			// set one corner
			setStyle( $el, propName, mathMax( 0, radius ) );

			// set immediate children if requested
			if ( children ) {
				children = select( '>div', $el );
				i = children.length;
				while ( i-- ) {
					setBorderRadius( children[ i ], UNDEFINED, side );
				}
			}
		}
	}  // setBorderRadius


	function scale ( currentWidth, currentHeight, targetWidth, targetHeight, ratio, fill, dir ) {
		// Clever little routine for calculating various dimension scaling scenarios.
		var
			limit = dir > 0 ? mathMax  // +ve dir, allow only upscale
				: dir < 0 ? mathMin  // -ve dir, allow only downscale
				: getFloat,  // allow either direction
			dx = limit( targetWidth - currentWidth, 0 ),
			dy = limit( targetHeight - currentHeight, 0 );

		if ( ratio === TRUE ) {  // boolean at launch, native ratio after measuring
			ratio = currentWidth / currentHeight;
		}
		if ( ratio ) {  // proportional width/height
			if ( ( dy * ratio - dx ) * ( fill ? 1 : -1 ) > 0 ) {
				// scale up if filling
				dx = dy * ratio;
			}
			else {
				// down if fitting
				dy = dx / ratio;
			}
		}

		return objectify(
			'width', currentWidth + dx,
			'height', currentHeight + dy
		);
	}  // scale


	function newWindow ( source, nameless, params ) {
		// window.open wrapper.
		var
			isHtml = rexHtml.test( source ),
			win = self.open(
				isHtml ? '' : source,
				nameless ? '' : '_fb', params || ''
			),
			doc = win && win.document;

		if ( !doc ) {
			alert( strings[ STR_popup ] );
		}

		else if ( isHtml ) {
			doc.open( 'text/html' );
			doc.write( '<!DOCTYPE html>' + makeOuterHtml( 'html', source ) );
			doc.close();
		}

		return win;
	}  // newWindow


	function ifNotSet ( val, defaultVal, nullVal ) {
		// Return defaults or alternatives for undefined values.
		return (
			val ? val  // quick return for truthy values
			: val === UNDEFINED || val === '' || ''+val == 'NaN' ? defaultVal
			: val !== NULL ? val  // includes false and 0
			: nullVal !== UNDEFINED ? nullVal
			: +defaultVal === defaultVal ? 0  // number
			: val
		);
	}  // ifNotSet


	function resolvePercent ( quantity, of, defaultVal ) {
		// Handles % settings for size options.
		return (
			+quantity === quantity ? quantity  // plain numbers go back unchanged
			: /%/.test( quantity ) ? mathFloor( getFloat( quantity ) / 100 * of )
			: defaultVal
		);
	}  // resolvePercent


	function runFromTopBox( funcName ) {
		// Shunts floatbox API calls on the fb object off to the topInstance for execution.

		return function ( a, b, c ) {  // 3 args for fb.resize
			var topBox = getInstance();

			if ( topBox ) {
				trigger( [ topBox[ funcName ], a, b, c ] );
			}
		};
	}  // runFromTopBox


	function maybeStart ( item ) {
		// Cookie management for autoStart:once requests set in activateItem
		// and showOnce tooltip starts from contipHandler.
		var
			itemSettings = item && item.itemSettings,
			fbCookie,
			contentHash;

		if ( itemSettings ) {

			if ( itemSettings.autoStart == 'once' || itemSettings.showOnce ) {
				fbCookie = parseOptions( topDoc.cookie ).fb || '';
				contentHash = '|' + getHash( item.boxContent );

				if ( fbCookie.indexOf( contentHash ) > -1 ) {
					item = NULL;  // already shown
				}
				else {
					topDoc.cookie = 'fb=' + fbCookie + contentHash + '; path=/';
				}
			}
			setTimer( [ start, item ],
				itemSettings.autoStart && ( +itemSettings.autoDelay || 0 ) * 999
			);
		}
	}  // maybeStart


	function camelCase ( str, kebab ) {
		// Convert to and from camelCase and kebab-case (css-case).
		return (
			kebab ? patch( str, /[A-Z]/g, '-$&' ).toLowerCase()
			: patch( str,
				/-([a-z]?)/g,
				function ( _0, $1 ) {
					return $1.toUpperCase();
				}
			)
		);
	}  // camelCase


	function getHash( str ) {
		// Returns a simple hash value of a string.
		// Modified djb2 hash from //www.cse.yorku.ca/~oz/hash.html
		str = ''+str;
		var
			hash = 5381,
			i = str.length;

		while ( i-- ) {
			// hash = hash * 33 ^ str.charCodeAt( i );
			hash = ( ( hash << 5 ) + hash ) ^ str.charCodeAt( i );  // slightly faster
		}
		return hash;
	}  // getHash


	function getInt ( str, base ) {
		// parseInt wrapper.
		return parseInt( str, base || 10 ) || 0;
	}  // getInt


	function getFloat ( str ) {
		return parseFloat( str ) || 0;
	}  // getFloat


	function getStrings ( language ) {
		// Set the shared strings var, maybe after fetching a requested language file.

		strings = data.strings || [
			'en',
			'Close (key: Esc)',
			'Prev (key: \u2190)',
			'Next (key: \u2192)',
			'Play (key: spacebar)',
			'Pause (key: spacebar)',
			'Resize (key: Page Up/Down)',
			'Image %1 of %2',
			'Page %1 of %2',
			'(%1 of %2)',
			'Info...',
			'Print...',
			'Open in a new window',
			'Pop-up content is blocked by this browser.'
		];
		if ( language && language != strings[ 0 ] ) {
			require( fbPath + 'languages/' + language + '.js', getStrings );
		}
	}  // getStrings


	function getIcons () {
		// Populate the fb.icons object with svg code.

		function buildSVG ( elements, width ) {
			width = width || 1000;
			var
				html = '',
				i;

			for ( i = 0; i < elements.length; i++ ) {
				html += makeOuterHtml( elements[ i ][ 0 ], FALSE, elements[ i ][ 1 ] );
			}

			return makeOuterHtml( 'svg', html, [
				'viewBox', '0 0 ' + width + ' 1000',
				'width', width / 1000 + 'em',
				'height', '1em'
			] );
		}

		icons = objectify(

			'close', buildSVG( [
				[ 'polygon', [ 'points', '0,230 170,60 850,740 680,910' ] ],
				[ 'polygon', [ 'points', '850,230 680,60 0,740 170,910' ] ]
			] ),

			'close' + 2, buildSVG( [
				[ 'circle', [ 'stroke-width', 100, 'fill', 'none', 'cx', 500, 'cy', 500, 'r', 450 ] ],
				[ 'polygon', [ 'points', '250,350 350,250 750,650 650,750' ] ],
				[ 'polygon', [ 'points', '750,350 650,250 250,650 350,750' ] ]
			] ),

			'close' + 3, buildSVG( [
				[ 'path', [ 'd', 'M125,275 Q50,200,125,125 T275,125 L875,725 Q950,800,875,875 T725,875 Z' ] ],
				[ 'path', [ 'd', 'M875,275 Q950,200,875,125 T725,125 L125,725 Q50,800,125,875 T275,875 Z' ] ]
			] ),

			'prev', buildSVG( [
				[ 'path', [ 'd', 'M0,500 L600,100 V325 H1000 V675 H600 V900 Z' ] ]
			] ),

			'next', buildSVG( [
				[ 'path', [ 'd', 'M1000,500 L400,100 V325 H0 V675 H400 V900 Z' ] ]
			] ),

			'prev' + 2, buildSVG( [
				[ 'path', [ 'd', 'M100,500 l392,439 q12,16,0,36 l-16,16 q-16,12,-36,0 l-433,-479 q-4,-12,0,-24 l433,-479 q16,-12,36,0, l16,16 q12,16,0,36 z' ] ]
			], 500 ),

			'next' + 2, buildSVG( [
				[ 'path', [ 'd', 'M400,500 l-392,439 q-12,16,0,36 l16,16 q16,12,36,0 l433,-479 q4,-12,0,-24 l-433,-479 q-16,-12,-36,0, l-16,16 q-12,16,0,36 z' ] ]
			], 500 ),

			'prev' + 3, buildSVG( [
				[ 'path', [ 'd', 'M0,500 l400,-400 q46,-46,92,0 t0,92 l-310,310 l310,310 q46,46,0,92 t-92,0 z M135,435 h800 q65,0,65,65 t-65,65 h-800 z' ] ]
			] ),

			'next' + 3, buildSVG( [
				[ 'path', [ 'd', 'M1000,500 l-400,-400 q-46,-46,-92,0 t0,92 l310,310 l-310,310 q-46,46,0,92 t92,0 z M865,435 h-800 q-65,0,-65,65 t65,65 h800 z' ] ]
			] ),

			'play', buildSVG( [
				[ 'path', [ 'd', 'M625,500 L0,875 V125 Z' ] ]
			], 625 ),

			'pause', buildSVG( [
				[ 'rect', [ 'x', 0, 'y', 125, 'width', 225, 'height', 750, 'rx', 75, 'ry', 75 ] ],
				[ 'rect', [ 'x', 400, 'y', 125, 'width', 225, 'height', 750, 'rx', 75, 'ry', 75 ] ]
			], 625 ),

			'play' + 2, buildSVG( [
				[ 'circle', [ 'stroke-width', 100, 'fill', 'none', 'cx', 500, 'cy', 500, 'r', 450 ] ],
				[ 'path', [ 'd', 'M375,720 V280 L755,500 z' ] ]
			] ),

			'pause' + 2, buildSVG( [
				[ 'circle', [ 'stroke-width', 100, 'fill', 'none', 'cx', 500, 'cy', 500, 'r', 450 ] ],
				[ 'path', [ 'd', 'M320,300 h125 v400 h-125 z M680,300 h-125 v400 h125 z' ] ]
			] ),

			'zoom', buildSVG( [
				[ 'circle', [ 'stroke-width', 100, 'fill', 'none', 'cx', 380, 'cy', 380, 'r', 330 ] ],
				[ 'path', [ 'd', 'M210,335 h340 v90 h-340 z M820,690 l170,170 q30,165,-135,135 l-170,-170 L580,580 z' ] ],
				[ 'path', [ 'd', 'M335,210 v340 h90 v-340 z' ] ]
			] ),

			'info', buildSVG( [
				[ 'circle', [ 'stroke-width', 100, 'fill', 'none', 'cx', 500, 'cy', 500, 'r', 450 ] ],
				[ 'circle', [ 'cx', 500, 'cy', 280, 'r', 70 ] ],
				[ 'path', [ 'd', 'M580,420 h-200 v70 h70 v200 h-70 v70 h270 v-70 h-70 z' ] ]
			] ),

			'print', buildSVG( [
				[ 'path', [ 'd', 'M170,800 V1000 H830 V800 H1000 V410 H830 V230 L600,0 H170 V410 H0 V800 z M780,950 H220 V765 H780 z M570,50 V260 H780 V510 H220 V50 z M60,475 h65 v65 h-65 z' ] ]
			] ),

			'newWindow', buildSVG( [
				[ 'path', [ 'stroke-width', 70, 'fill', 'none', 'd', 'M500,120 h-350 q-120,0,-120,120 v520 q0,120,120,120 h610 q120,0,120,-120 v-270' ] ],
				[ 'path', [ 'd', 'M970,0 q30,0,30,30 v280 c0,60,-60,30,-60,30 l-280,-280 c-30,-60,30,-60,30,-60 z M915,0 l85,85 l-530,530 l-85,-85 z' ] ]
			] ),

			'dragger', buildSVG( [
				[ 'path', [ 'd', 'M160,1000 h-160 L1000,0 v160 z M500,1000 h-160 L1000,317 v160 z M826,1000 h-160 L1000,643 v160 z' ] ]
			] ),

			'tooltip' + 'top', buildSVG( [
				[ 'path', [ 'd', 'M0,0 h1000 l-500,800 z' ] ]
			] ),

			'tooltip' + 'right', buildSVG( [
				[ 'path', [ 'd', 'M1000,0 v1000 l-800,-500 z' ] ]
			] ),

			'tooltip' + 'bottom', buildSVG( [
				[ 'path', [ 'd', 'M1000,1000 h-1000 l500,-800 z' ] ]
			] ),

			'tooltip' + 'left', buildSVG( [
				[ 'path', [ 'd', 'M0,1000 v-1000 l800,500 z' ] ]
			] )

		);
	}  // getIcons

///  begin video functions

	function videoPrep ( item ) {
		// Configure iframe video service URLs.
		var
			rexFb = /(\.mp4)$/i,
			rexYouVim = /(youtube|vimeo)\.com\/([\w-]+)/,
			itemSettings = item.itemSettings,
			pathParts = parseUrl( item.boxContent ),
			path = patch( pathParts.noQuery, 'youtu.be', 'youtube.com' ),
			qs = pathParts.query,
			autoplay = ifNotSet( itemSettings.autoPlayVideo, qs.autoplay != '0' ) ? 1 : 0,
			autoend = ifNotSet( itemSettings.autoEndVideo, qs.autoend != '0' ) ? 1 : 0,
			params = {  // to be added to all video querystrings
				autoplay: autoplay,
				bgcolor: itemSettings.contentBackgroundColor || 'transparent'
			},
			vidService,
			vidId,
			match;

		// fb's video player
		if ( ( match = rexFb.exec( path ) ) ) {

			//  vidService = 'fb';
			item.vidPoster = patch( path, match[ 1 ], '.jpg' );
			path = resourcesFolder + 'video.html';

			extend( params, {
				autoend: autoend,
				esc: itemSettings.enableKeyboardNav,
				source: item.boxContent,
				fb: fbPath
			} );
		}

		else if ( ( match = rexYouVim.exec( path ) ) ) {
			vidService = match[ 1 ];
			vidId = qs.v || match[ 2 ];  // qs.v from youtube.com/watch?v=id
			deleteProp( qs, 'v' );

		// youtube embed
			if ( vidService == 'youtube' ) {
				path = 'https://www.youtube.com/embed/' + vidId;
				extend( params, {
					fs: 1,  // fullscreen
					autohide: 1,  // hide the controls bar
					showinfo: 0,  // no title and youtube logo at the top
					rel: 0,  // don't show related
					enablejsapi: 1  // for auto-ending
				} );
				item.vidPoster = 'https://img.youtube.com/vi/' + vidId + '/maxresdefault.jpg';
			}

		// vimeo embed
			else {  // vimeo
				path = 'https://player.vimeo.com/video/' + vidId;
				extend( params, {
					badge: 0,
					byline: 0,
					portrait: 0,
					title: 0
				} );
			}
		}

		item.boxContent = parseUrl( path, extend( params, qs ) ).fullUrl;
		item.vidService = vidService;
		itemSettings.autoEndVideo = autoend;  // messageHandler needs to know

		// add video thumb (and play button) for youtube and vimeo
		if ( vidService == 'vimeo' && itemSettings.fetchVideoInfo !== FALSE ) {
			// pull info from vimeo api first

			ajax( 'https://vimeo.com/api/v2/video/' + vidId + '.json', {
				finish: function ( xhr ) {
					var response = xhr.responseJSON;
					if ( response ) {
						response = response[ 0 ];  // vimeo returns an array
						itemSettings.caption = ifNotSet( itemSettings.caption, response.title );
						itemSettings.width = itemSettings.width || getInt( response.width );
						itemSettings.height = itemSettings.height || getInt( response.height );
						item.vidPoster = response.thumbnail_large;
					}
					videoAddThumb( item );
				}
			} );
		}
		else {
			videoAddThumb( item );
		}
	}  // videoPrep


	function videoAddThumb ( item ) {
		// Insert or update a video link thumbnail.
		var
			itemSettings = item.itemSettings,
			addVideoThumb = itemSettings.addVideoThumb,
			$host = item.hostEl,
			thumbSource = item.vidPoster;

		function addThumb ( $img ) {
			var
				$thumb,
				width,
				height;

			if ( $img.ok ) {

				$thumb = item.thumbEl;
				if ( !$thumb ) {
					$thumb = item.thumbEl = newElement( 'img' );
					placeElement( $thumb, $host, $host.firstChild );
				}

				width = $thumb.width || 0;  // user can style a blank.gif thumb placeholder
				width = mathMin( $img.width,
					width > 32 ? width  // ie's broken-image image is 28px wide
					: +addVideoThumb === addVideoThumb ? addVideoThumb  // numeric width request
					: addVideoThumb == 'small' ? 120
					: addVideoThumb == 'large' ? 480
					: 240  // default medium
				);
				height = $thumb.height = width * $img.height / $img.width;  // keep it proportional

				setStyle( $thumb, [
					'width', width,
					'height', height,
					'maxWidth', width
				] );
				$thumb.src = thumbSource;

				item.playButton = ifNotSet( item.playButton,
					width < 180 ? 'small' :
					width > 360 ? 'large' :
					TRUE
				);
				videoAddPlay( item );

				itemSettings.zoomSource = ifNotSet( itemSettings.zoomSource, thumbSource );
			}
		}

		// handle zoomSource='poster' here (after videoPrep has set vidPoster)
		if ( itemSettings.zoomSource == 'poster' ) {
			itemSettings.zoomSource = thumbSource || NULL;
		}

		if ( addVideoThumb !== FALSE && $host && thumbSource ) {
			preload( thumbSource, addThumb );
		}
		else {
			videoAddPlay( item );
		}
	}  // videoAddThumb


	function videoAddPlay ( item ) {
		// Add video play button to an existing thumb.
		var
			size = item.playButton,
			$thumb = size && item.thumbEl;

		function addPlay ( $img ) {
			var
				$wrapper,
				$playButton;

			if ( $img.ok ) {

				// put a wrapper around the thumb img element
				$wrapper = $thumb.parentElement;
				if ( !hasClass( $wrapper, 'fbVid' ) ) {
					$wrapper = wrapElement( $thumb, 'span' );
					addClass( $wrapper, 'fbVid' );

					setStyle( $wrapper, [
						'cssText', getStyle( $thumb ),
						'display', 'inline-block',
						'position', 'relative',
						'overflow', 'hidden',
						'width', $thumb.width,
						'height', $thumb.height
					] );

					setStyle( $thumb, [
						'position', 'relative',
						'border', 0,
						'margin', 0
					] );
				}

				// add a play button to the wrapper
				$playButton = select( 'i', $wrapper, 0 ) || newElement( 'i', icons.play );
				addClass( $playButton, 'fbIcon' );
				placeElement( $playButton, $wrapper );

				setStyle( $playButton, [
					'position', 'absolute',
					'fontSize', size == 'small' ? 20 : size == 'large' ? 48 : 28
				] );

				setStyle( $playButton, [  // left and top
					( getStyle( $wrapper, 'width', TRUE ) - $playButton.offsetWidth ) / 2,
					( getStyle( $wrapper, 'height', TRUE ) - $playButton.offsetHeight - 1 ) / 2
				] );
			}
		}

		if ( $thumb ) {
			preload( $thumb.src, addPlay ); // make sure thumb is fetched so we get proper size info
		}
	}  // videoAddPlay

///  end video functions

///  begin contip functions

	// fbContext and fbTooltip default options
	var
		contipSettings = objectify(
			'autoFitSpace', 2,
			'minWidth', 0,
			'minHeight', 0,
			'enableDragMove', FALSE,
			'enableDragResize', FALSE,
			'innerBorder', 0,
			'outerBorder', 1,
			'outsideClickCloses', TRUE,
			'padding', 0,
			'contentScroll', FALSE,
			'showClose', FALSE,
			'showOuterClose', FALSE,
			'titleAsCaption', FALSE
		),
		contextSettings = extend( {},
			contipSettings,
			objectify(
				'boxLeft', 'click',
				'boxTop', 'click',
				'boxCornerRadius', 0,
				'fadeTime', 0,
				'shadowSize', 8,
				'shadowType', 'hybrid'
			)
		),
		tooltipSettings = extend( {},
			contipSettings,
			objectify(
				'boxCornerRadius', 4,
				'fadeTime', 0.2,
				'shadowSize', 4,
				'shadowType', 'drop'
			)
		);


	function contipActivate ( $hosts, ownerBox ) {
		// Light up fbContext and fbTooltip elements.
		var
			$host,
			isContext,
			itemSettings,
			item,
			i;

		for ( i = 0; i < $hosts.length; i++ ) {
			$host = $hosts[ i ];
			isContext = hasClass( $host, contextClass );
			itemSettings = parseOptions( attr( $host, 'data-fb-' + ( isContext ? 'context' : 'tooltip' ) ) );

			if ( itemSettings.source && !items[ $host.tip ] ) {  // not already activated
				addClass( itemSettings, getClass( $host ) );  // import user-defined class settings
				itemSettings.contipSettings = isContext ? contextSettings : tooltipSettings;
				// activate as a standard floatbox item
				item = activateItem( NULL, ownerBox, itemSettings );

				if ( item ) {
					item.hostEl = $host;
					item.isContip = TRUE;
					item.isTooltip = !isContext;
					$host.tip = items.length - 1;  // event handler can find the items record
					itemSettings = item.itemSettings;
					itemSettings.modal = itemSettings.sameBox = FALSE;  // these can't be overridden
					itemSettings.resizeTime = 0;
					itemSettings.group = NULL;

					addEvent( $host,
						isContext ? [
							'touchend',
							itemSettings.contextMouseButton != 'right' && 'click',
							itemSettings.contextMouseButton != 'left' && 'contextmenu'
							// contextmenu may be unreliable
						]
						: [  // isTooltip
							'mouseover',
							'mouseout',
							!getTagName( $host, [ 'a', 'area' ] ) && 'touchend'
							// don't disrupt link touches
						],
						contipHandler
					);
				}
			}
		}
	}  // contipActivate


	function contipHandler ( e ) {
		// event handler for context and tooltip host nodes.
		var
			eType = e.type,
			related = e.relatedTarget,  // may be null if from and to els are on different docs
			$this = this,
			instance = $this.fbName == 'fbMain' && getOwnerInstance( $this ),
			item = instance && instance.activeItem || items[ $this.tip ],
			i;

		if ( item
			&& ( !usingTouch || tapDetails.eType && !/mouse/.test( eType ) )
			// ignore multi-touches and follow-on events after a touch
		) {
			// fbContext
			// (outsideClickCloses and keydownHandler do the work of closing context boxes)
			if ( hasClass( item.itemSettings, contextClass ) ) {
				if ( tapDetails.eType ) {
					stopEvent( e );
					start( item );
				}
			}

			// fbTooltip
			else {

				// find showing instance
				i = instances.length;
				while ( !instance && i-- ) {
					instance = instances[ i ] || {};
					if ( instance.activeItem != item ) {
						instance = NULL;
					}
				}

				if ( eType == 'mouseout' ) {
					if ( !(
						nodeContains( item.hostEl, related )
						|| ( instance && nodeContains( instance.fbMain, related ))
						// ignore mouseouts when the related mouseover target is our host or box
					) ) {
						clearTimer( TIMER_tooltip );
						if ( instance ) {
							instance.state = STATE_start;  // allows end to proceed early
							setTimer( instance.end );  // need timer in case box is just starting up
						}
					}
				}

				// mouseover and touchend start a tooltip
				else if ( !instance && !timeouts[ TIMER_tooltip ] ) {  // not already started
					( usingTouch ? trigger : setTimer )(  // go, maybe, after a while
						[ maybeStart, item ],
						ifNotSet( item.itemSettings.delay, 333 ),
						TIMER_tooltip
					);
				}
			}
		}
	}  // contipHandler

///  end contip functions

///  begin cycler functions

// cyclers: [ {
//   hostDiv: <div>,
//   members: [ {
//      memberEl: <a/div>,
//      imgSrc: <img>.src,
//      imgEl: <img>,
//      captionSpan: <span>
//   }, ... ],
//   showing: members index,
//   paused: boolean,
//   controlSpan: <span>,
//   aniWrapper: <i>,
//   progress: {} for animate monitor data,
//   cycFadeTime:  seconds
//   cycZoom: fraction,
//   cycEasing: >= 1,
//   cycInflection: easing inflection point,
//   cycControlsPos: pos string
// }, ... ]

	function cyclerActivate ( $hosts ) {
		// Light up the cycler divs on this page.
		var
			$host,
			tagName,
			caption,
			$img,
			imgSrc,
			$captionSpan,
			$aniWrapper,
			$child,
			idx,
			i, j;

		for ( i = 0; i < $hosts.length; i++ ) {
			$host = $hosts[ i ];
			if ( $host && !cyclers[ $host.fbx ] ) {  // not already activated
				var
					members = [],
					divSettings = extend( {}, baseSettings, parseOptions( $host ) ),
					children = [].slice.call( $host.children );

				// gather node:img pairs that live inside this cycler div
				for ( j = 0; j < children.length; j++ ) {
					$child = children[ j ];

					if ( ( tagName = getTagName( $child, [ 'img', 'div', 'a' ] ) ) ) {

						if ( tagName == 'img' ) {
							// wrap bare images in divs (for css display and absolute positioning)
							$img = $child;
							$child = wrapElement( $img, 'div' );  // pass node type to prevent styling
						}
						else {
							$img = select( 'img', $child, 0 );  // the first image in the node
						}

						imgSrc = attr( $img, 'data-fb-src' )  // first choice
							|| /\.(jpe?g|png|gif|webp)\b/i.test(
								attr( $img, 'longdesc' )  // image path or a true longdesc?
							) && imgSrc
							|| attr( $img, 'src' );  // no alternate being used

						if ( imgSrc ) {  // has something to cycle

							// sort out caption
							$captionSpan = select( 'span', $child, 0 );
							if ( !$captionSpan ) {
								caption = divSettings.titleAsCaption !== FALSE && attr( $img, 'title' )
									|| divSettings.altAsCaption && attr( $img, 'alt' )
									|| '';
								if ( caption ) {
									$captionSpan = newElement( 'span', caption );
									placeElement( $captionSpan, $child );
								}
							}

							// save node, image, caption and per-item interval in the members array
							members.push( {
								memberEl: $child,
								imgSrc: imgSrc,
								imgEl: $img,
								captionSpan: $captionSpan
							} );
						}
					}
				}

				// if more than one node/img pair, setup cycler and save it to the items array
				if ( members.length > 1 ) {
					var
						cycZoom = ifNotSet( divSettings.cycleZoom, 0.2 ),
						enableClick = ifNotSet( divSettings.cyclePauseOnClick,
							divSettings.cycleEnableClick  // cycleEnableClick is legacy
						),
						cycControlsPos = enableClick
							&& divSettings.cycleShowControls !== FALSE
							&& ( divSettings.cycleControlsPos || 'bl' );

					// interval applies to all cyclers on the page
					cycleInterval = divSettings.cycleInterval || cycleInterval;

					// add a wrapper with two img or canvas elements for doing the animation work
					// use <i> to avoid .fbCycler span caption styling
					$aniWrapper = placeElement( newElement( 'i' ), $host );
					tagName = cycZoom ? 'canvas' : 'img';
					setStyle( [  // two new elements
							placeElement( newElement( tagName ), $aniWrapper ),
							placeElement( newElement( tagName ), $aniWrapper ),
							$aniWrapper
						],
						[
							'position', 'absolute',
							'left', 0,
							'top', 0,
							'padding', 0,
							'borderWidth', 0,
							'margin', 0,
							'width', '100%'
						]
					);

					// add visible play/pause control on top of the div
					$child = cycControlsPos && placeElement( newElement( 'i' ), $host );
					addClass( $child, 'fbCyclerControl' );  // might be empty

					$host.fbx = idx = cyclers.length;
					cyclers.push( {
						hostDiv: $host,
						members: members,  // all the usable nodes (and their thumbs) in this div
						showing: members.length - 1,  // initialized to last img for show setup below
						paused: enableClick && divSettings.cycleStartPaused,  // initial pause state
						controlSpan: $child,
						aniWrapper: $aniWrapper,
						progress: { step: 1 },  // flag as complete so the first animation can proceed
						cycFadeTime: ifNotSet( divSettings.cycleFadeTime, 1.7 ),
						cycZoom: cycZoom,
						cycEasing: divSettings.cycleEasing || 1.4,
						cycInflection: divSettings.cycleInflection,
						cycControlsPos: cycControlsPos
					} );

					// use cyclerShow to initialize the animator span
					cyclerShow( idx, 0, TRUE );

					// add click/touch/hover handlers to toggle paused state
					addEvent( $host,
						enableClick ? [ 'touchend', 'click' ]
						: divSettings.cyclePauseOnHover ? [ 'mouseover', 'mouseout' ]
						: NULL,
						cyclerHandler
					);
				}
			}
		}

		if ( !timeouts[ TIMER_show] ) {
			setTimer( cyclerShowNext, cycleInterval * 377, TIMER_show );  // start 'em up
		}
	}  // cyclerActivate


	function cyclerHandler ( e ) {
		// Pause/resume on mouse/touch events.
		var cycler = cyclers[ this.fbx ];

		if ( cycler
			&& ( !usingTouch || e.type == 'touchend' )
			&& !nodeContains( cycler.hostDiv, e.relatedTarget )
		) {
			cyclerPause( cycler,
				e.type == 'mouseover' ? TRUE
				: e.type == 'mouseout' ? FALSE
				: !cycler.paused  // click or touch toggles pause
			);
		}
	}  // cyclerGetHandler


	function cyclerPause ( cycler, stop ) {
		// Pause/unpause and set innerHTML of the cycler control to match the pause state.
		var
			$control,
			cycControlsPos,
			imgLayout,
			imgBorder,
			dx;

		if ( stop !== UNDEFINED ) {  // no stop or start request? just paint the control below
			cycler.paused = stop;
			cycler.progress.active = !stop;  // resume or suspend in-progress animations
		}

		if ( ( $control = cycler.controlSpan ) ) {

			$control.innerHTML = patch( strings[ cycler.paused ? STR_play : STR_pause ],
				// unbracketed text + two spaces + icon
				/\(.+\)/,
				'&nbsp;' + makeOuterHtml(
					'i',
					icons[ ( cycler.paused ? 'play' : 'pause' ) + 2 ],
					[ 'class', 'fbIcon' ]
				)
			);
			setStyle( $control, 'display', 'inline-block' );  // before getting offsetWidth/Height

			cycControlsPos = cycler.cycControlsPos;
			imgLayout = getLayout( cycler.members[ cycler.showing ].imgEl );
			imgBorder = imgLayout.border;
			dx = imgLayout.width - $control.offsetWidth;

			setStyle( $control, [
				/r/.test( cycControlsPos )
					? dx - imgBorder.right - 12
					: /c/.test( cycControlsPos )
					? dx / 2
					: imgBorder.left + 12,
				/b/.test( cycControlsPos )
					? imgLayout.height - $control.offsetHeight - imgBorder.bottom - 12
					: imgBorder.top + 12
			] );
		}
	}  // cyclerPause


	function cyclerShowNext () {
		// Cycle to the next member of all divs.
		var
			limit = -1,
			cycler,
			$host,
			instance,
			i;

		// show next member of each unpaused cycler div
		// unless it's under a modal box
		i = instances.length;
		while ( i-- ) {
			instance = instances[ i ];
			if ( instance && instance.isModal ) {
				limit = mathMax( instance.stackOrder, limit );
			}
		}

		i = cyclers.length;
		while ( i-- ) {
			if ( ( cycler = cyclers[ i ] ) ) {

				if ( ( $host = cycler.hostDiv ) ) {  // the cycler div might have gone away

					// cycle unpaused, visible, idle cyclers
					if ( !( cycler.paused || document.hidden )
						&& !( cycler.progress.active && cycler.progress.step < 1 )
					) {
						// check ownerInstance each time because cycler div might be in box content
						instance = getOwnerInstance( $host );
						if ( !instance || limit < instance.stackOrder ) {
							// cycle a cycler only if it's in or above the top-most modal box
							cyclerShow( i, cycler.showing + 1 );
						}
					}
				}
			}
		}

		if ( !timeouts[ TIMER_show] ) {
			setTimer( cyclerShowNext, cycleInterval * 999, TIMER_show );
		}
	}  // cyclerShowNext


	function cyclerShow ( iDiv, iNode, setup ) {
		// Display (unhide) the iNode'th node in the iDiv'th div,
		// fading unless asked not to.
		var
			cycler = cyclers[ iDiv ],
			$aniWrapper = cycler.aniWrapper,
			$ani = $aniWrapper.firstChild,  // the first of the two animation img or canvas worker bees
			members = cycler.members,
			nodeToShow = iNode % members.length,  // handle wrapping so the caller doesn't have to
			currentMember = members[ cycler.showing ],
			nextMember = members[ nodeToShow ],
			$nextEl = nextMember.memberEl,  // the new node to be faded in
			$nextImg = nextMember.imgEl,
			cycZoom = cycler.cycZoom,
			cycInflection = cycler.cycInflection,
			width,
			height,
			aniStart,
			aniEnd,
			swap;

		if ( setup || $nextImg
			&& ( preloads[ nextMember.imgSrc ] || {} ).ok  // img has finished loading
		) {

			if ( !setup || !timeouts[ TIMER_show] ) {
				setStyle( nextMember.captionSpan, 'opacity', 0 );
				setStyle( $nextImg, 'visibility', 'hidden' );
			}
			setStyle( $nextEl, [
				'position', 'absolute',
				'visibility', 'visible'
			] );
			setStyle( cycler.hostDiv, 'height', $nextEl.offsetHeight );

			// width and height have to be picked up after above style changes
			// otherwise webkit does weird stuff with max-width:100% on the wrapper div
			width = $nextImg.width;  // use the actual img node to pick up non-native sizing
			height = $nextImg.height;

			// default animation start
			aniStart = objectify( 0, 0, width, height );
			// place animator into the incoming img's parent so it can pick up anchor clicks
			// and copy that img's css so layout won't change
			setStyle( $aniWrapper, [
					'cssText', getStyle( $nextImg ),
					'zIndex', getStyle( $nextImg, 'zIndex', TRUE ) + 1,
					'display', 'inline-block',
					'position', 'absolute',
					'visibility', 'visible'
				],
				aniStart
			);
			placeElement( $aniWrapper, $nextImg.parentElement );

			// initial state for animation
			setBorderRadius( $ani );  // pull in roundies from aniWrapper which pulled them in from the img
			setStyle( $ani, 'opacity', 0 );
			$ani.src = $nextImg.src;  // for img elements
			$ani.width = width;  // canvas size has to be set in pixels
			$ani.height = height;
			placeElement( $ani, $aniWrapper );  // move over top of previous ani[ 0 ]

			// start the opacity fades
			animate( [
					[ [ $ani, nextMember.captionSpan ], 'opacity', 1 ],
					[ currentMember.captionSpan, 'opacity', 0 ]
				],
				[ setStyle, currentMember.imgEl, 'visibility', 'hidden' ],
				setup ? 0 : cycler.cycFadeTime * 990
			);

			// do the zoom/pan thing
			if ( cycZoom ) {

				aniEnd = objectify(
					-mathRandom( width * cycZoom ),
					-mathRandom( height * cycZoom ),
					width * ( 1 + cycZoom ),
					height * ( 1 + cycZoom )
				);

				// randomly swap zooming in or out
				if ( setup || mathRandom( 1 ) ) {
					cycZoom *= -aniStart.width / aniEnd.width;
					swap = aniStart;
					aniStart = aniEnd;
					aniEnd = swap;
				}

				// randomize easing inflection point if not specified
				if ( +cycInflection !== cycInflection ) {
					cycInflection = mathRandom( 80 ) / 100 + 0.1;  // between .1 and .9
				}

				// rig up the canvas context so it can be used like an img in animate
				aniEnd.$ = $ani = $ani.getContext( '2d' );
				$ani.img = $nextImg;  // tells animate what img to draw
				$ani.style = aniStart;  // fake style property for initial values

				// start zooming
				animate( aniEnd, 0,
					setup ? 0 : cycleInterval * 990,
					cycInflection,
					setup ? 1 : cycler.cycEasing,
					cycler.progress
				);
			}
		}

		cycler.showing = nodeToShow;

		// display the control at the first cycle
		if ( !setup ) {
			cyclerPause( cycler );
		}

		// prep the next one for showing
		nextMember = members[ ( nodeToShow + 1 ) % members.length ];
		preload( nextMember.imgEl.src = nextMember.imgSrc );
	}  // cyclerShow

///  end cycler functions

///  begin popup functions

	function popupActivate ( $hosts, ownerBox ) {
		// Adds mouse over/out actions to popup thumbnails (including index links).
		var
			$host,
			$thumb,
			match,
			i;

		i = $hosts.length;
		for ( i = 0; i < $hosts.length; i++ ) {
			$host = $hosts[ i ];
			if ( !popups[ $host.pop ] ) {  // don't reactivate

				$thumb = select( 'img', $host, 0 );
				match = getClass( $host ).join( ' ' );
				if ( ( match = $thumb && /\bfbPop(\w+)\b/i.exec( match ) ) ) {

					$host.pop = popups.length;  // popups index on the host's expando
					popups.push( {
						hostEl: $host,
						thumbEl: select( 'img', $host, 0 ),
						popupType: match[ 1 ].toLowerCase(),
						ownerBox: ownerBox  // for destroy's cleanup
					} );

					// add event handlers
					addEvent( $host,
						[ 'click', 'mouseover', 'mouseout' ],
						popupHandler,
						TRUE
					);
				}
			}
		}
	}  // popupActivate


	function popupHandler ( e ) {
		// Event handler assigned to popup thumb host elements.
		var
			eType = e.type,
			$this = this,
			item = popups[ $this.pop ],
			$thumb = item && item.thumbEl,
			hidden;

		if ( $thumb ) {
			hidden = $thumb.offsetTop == -bigNumber;

			if ( usingTouch ) {
				if ( hidden && eType == 'click' ) {
					popupShow( $this );
					stopEvent( e );  // prevent following nofloatbox link
					tapHandler();  // prevent starting floatbox link
				}
			}

			else {
				if ( hidden && eType == 'mouseover' ) {
					popupShow( $this );
				}
				else if ( !hidden && eType == 'mouseout' ) {
					popupHide( $this );
				}
			}
		}
	}  // popupHandler


// popupShow()

	function popupShow ( $host ) {
		// Popup a popup.
		var
			item = $host && popups[ $host.pop ],
			$thumb = item && item.thumbEl;

		if ( $thumb && $thumb.offsetTop < 0 ) {

			setStyle( $host, 'display', 'inline-block' );  // anchor height will encompass thumbs
			popupHideAll();  // can show only one popup thumb at a time

			var
				popupType = item.popupType,
				parentLayout = simpleLayout(
					popupType == 'center'
					&& select( 'img', $host, 1 )
					|| $host
				),
				thumbLayout = simpleLayout( $thumb ),
				thumbWidth = thumbLayout.width,
				thumbHeight = thumbLayout.height,
				left = parentLayout.left,
				top = parentLayout.top,
				context = getOwnerInstance( $thumb );

			left += popupType == 'left' ? -thumbWidth
				: popupType == 'right' ? parentLayout.width - 1
				: ( parentLayout.width - thumbWidth ) / 2;  // center
			top += popupType == 'up' ? 2 - thumbHeight
				: popupType == 'down' ? parentLayout.height - 1
				: ( parentLayout.height - thumbHeight ) / 2;  // center

			// if popup is offscreen, move it in
			context = context
				? simpleLayout( context.fbLiner )  // use fbLiner as the screen for stuff within it
				: objectify( 0, 0, viewport.width, viewport.height );
			left = mathMin( left, context.left + context.width - thumbWidth );  // move in from right
			left = mathMax( left, context.left );  // move in from left
			top = mathMin( top, context.top + context.height - thumbHeight );  // move up from bottom
			top = mathMax( top, context.top );  // move down from top

			// position relative to offsetParent
			parentLayout = simpleLayout( $thumb.offsetParent );
			setStyle( $thumb, [
				left - parentLayout.left,
				top - parentLayout.top
			] );
		}
	}  // popupShow


	function popupHide ( $host ) {
		// Hide one popup thumb.
		var item = !popupLocked && $host && popups[ $host.pop ];

		if ( item ) {
			setStyle( item.thumbEl, [ 0, -bigNumber ] );
		}
	}  // popupHide


	function popupHideAll ( $except ) {
		// Hide all popups, optionally except one.
		var
			item,
			$host,
			i;

		i = popups.length;
		while ( i-- ) {
			if ( ( item = popups[ i ] ) ) {
				$host = item.hostEl;
				if ( nodeContains( document, $host ) && !nodeContains( $host, $except ) ) {
					popupHide( $host );
				}
			}
		}
	}  // popupHideAll

///  end popup functions

///  end internal functions

///  begin Box object

	function newBox ( isModal ) {
		// Box object factory.

		/// begin Box private vars
		var
			thisBox = {},  // this
			boxIndex = instances.length,
			currentSet = [],
			activeSettings = {},
			boxEvents = [],
			itemEvents = [],
			boxTimeouts = {},  // per-box setTimer key repository
			optionMetrics = {},  // box metrics requested through options
			requestedMetrics = {},  // net of optionMetrics and fb.resize requests
			appliedMetrics = {},  // box metrics in effect, including accumulated moves and resizes
			deltaMetrics = objectify( zeroes ),  // changes to box metrics made by mousemoveHandler
			nodeNames = [],  // keep track of created nodes for clean decommissioning
			tabRestrictions = [],  // main-page elements set to tabindex = -1
			tabIndices = [],  // captured original tabindex for tabRestrictions members
			itemsShown = 0,  // slideshow counter
			animationStatus = {},  // for monitoring boxAnimations
			animationQueue = [],  // pending synchronous boxAnimation requests
			afterAnimation,  // current animation's finish function
			activeItem, activeIndex,
			afterResize,
			autoFit,
			autoFitSpace,
			boxColor,
			boxRadius,
			boxWidth, boxHeight,
			boxSettings,
			contentSwiped,
			controlsPos,
			crossAnimate,
			crossFade,
			crossSlide,
			crossExpand,
			crossShift,
			draggerLocation,
			enableDragMove,
			endAt,
			enableKeyboardNav,
			enableSwipeNav,
			enableWrap,
			fadeTime,
			gradientColors,
			hasCaption,
			hasCaption2,
			hasFooter,
			hasHeader,
			hasImage,
			hasInfo,
			hasItemNumber,
			hasNewWindow,
			hasPrint,
			headerSpace, footerSpace,
			imageSwap,
			imageTransition,
			indexPos,
			inFrameResize,
			innerBorder, innerBorderX2,
			innerBorderColor,
			isTooltip, isContip,
			isFixedPos,
			isPaused,
			isSlideshow,
			itemCount,
			justImages,
			maxBoxWidth, maxBoxHeight,
			maxWidth, maxHeight,
			minWidth, minHeight,
			nativeWidth, nativeHeight,
			navButton, navOverlay,
			numIndexLinks,
			outerBorder, outerBorderX2,
			outerBorderColor,
			outerClosePos,
			overflow,
			overlayColor,
			overlayFadeTime,
			overlayOpacity,
			padding,
			pageScrollDisabled,
			panelPadding,
			parentBox,
			prevHref, nextHref,
			prevIndex, nextIndex,
			previousItem, previousIndex,
			previousSettings,
			resizeTime,
			resizeTool,
			shadowOpacity,
			shadowSize,
			shadowType,
			showClose,
			showHints,
			showControlsText,
			showNavOverlay,
			showPlayPause,
			sizeRatio,
			sizeState,
			smallBoxSize,
			splitResize,
			startingViewport,
			startItem,
			startPos,
			startTapX, startTapY,
			stickyMove, stickyResize,
			strongTextColor,
			textColor,
			transitionTime,
			zoomBorder,
			zoomer,
			// minification assistants for box element references
			$fbContent,
			$fbContentWrapper,
			$fbLiner,
			$fbMain,
			$fbOverlay;

		/// end Box private vars

		/// begin Box api methods


		function showItem ( newIndex, reload ) {
			// Called by prev/next events, pause, index links, slideshow timer, or external code.
			// 'reload' allows refresh of currently showing activeItem.
			newIndex =
				newIndex == 'prev' ? prevIndex :
				newIndex == 'next' ? nextIndex :
				+newIndex;
			var
				newItem = currentSet[ newIndex ],
				newSettings,
				after,
				i;

			if ( reload || newIndex != activeIndex ) {
				if ( newItem ) {
					newSettings = extend( newItem.itemSettings );

					if ( thisBox.state == STATE_show
						&& trigger( activeSettings.beforeItemEnd, thisBox ) !== FALSE
						&& trigger( newSettings.beforeItemStart, thisBox ) !== FALSE
					) {

						previousItem = activeItem;
						previousIndex = activeIndex;
						previousSettings = activeSettings;
						thisBox.activeItem = activeItem = newItem;
						activeIndex = newIndex;
						activeSettings = newSettings;

						clearTimer( TIMER_slideshow, boxTimeouts );
						putInlineBack( previousItem );  // move existing content and captions back to host page
						trigger( previousSettings.afterItemEnd );
						thisBox.state = STATE_transition;

						if ( !fitContent( launchItem ) ) {
							launchItem();
						}
					}
				}

				else if ( isSlideshow && thisBox.state ) {

					after = boxSettings.afterSlideshow;

					if ( itemsShown < itemCount || after == 'loop' ) {
						if ( !isPaused && !document.hidden ) {
							showItem( 'next' );
						}
					}

					else if ( after == 'stop' ) {
						pause( TRUE );
						i = itemCount;
						while ( i-- ) {
							currentSet[ i ].seen = FALSE;
						}
						itemsShown = 0;
					}

					else {  // default is 'exit'
						end();
					}
				}
			}
		}  // showItem


		function resize ( request, then, animationTime ) {
			// Resize a box in place.
			request = objectify( request );
			var
				dims = objectify(
					+stickyMove,
					+stickyMove,
					+stickyResize,
					+stickyResize
				),  // left, top, width, height
				dim;

			if ( thisBox.state == STATE_show ) {
				for ( dim in dims ) {

					if ( request[ dim ] === TRUE ) {
						request[ dim ] = appliedMetrics[ dim ];
					}
					if ( request[ dim ] === UNDEFINED ) {
						if ( !dims[ dim ] ) {  // not sticky
							deltaMetrics[ dim ] = 0;
						}
					}

					else {
						deltaMetrics[ dim ] = 0;
						if ( sizeRatio ) {
							if ( dim == 'width' && !request.height ) {
								request.height =
									resolvePercent( request.width, viewport.width ) / sizeRatio;
								deltaMetrics.height = 0;
							}
							if ( dim == 'height' && !request.width ) {
								request.width =
									resolvePercent( request.height, viewport.height ) * sizeRatio;
								deltaMetrics.width = 0;
							}
						}
					}
				}

				if ( activeItem.isHtml && !( request.width && request.height ) ) {
					getNativeHtmlSize( $fbContent );
				}

				if ( activeItem.isImage ) {
					setStyle( $fbContent, [ 0, 0, '100%', '100%' ] );  // undo inframe-resizing
				}

				requestedMetrics = extend( {}, optionMetrics, request );
				appliedMetrics = {};

				afterResize = then;
				thisBox.state = STATE_resize;
				calcAppliedMetrics( [ calcSize, UNDEFINED, animationTime ] );
			}
		}  // resize


		function pause ( stop ) {
			// Sets slideshow state to paused or playing
			// and displays the appropriate control button.

			if ( isSlideshow ) {

				isPaused = stop;
				clearTimer( TIMER_slideshow, boxTimeouts );

				// show the appropriate control (if it's there)
				setStyle( thisBox.fbPlay, 'display', stop ? '' : 'none' );
				setStyle( thisBox.fbPause, 'display', stop ? 'none' : '' );

				if ( !stop ) {
					showItem( 'next' );
				}
			}
		}  // pause


		function reload ( source ) {
			// Refresh or replace the current content.

			if ( activeItem && activeItem.isUrl ) {

				if ( !activeItem.originalBoxContent ) {
					activeItem.originalBoxContent = activeItem.boxContent;
				}

				activeItem.boxContent = source || parseUrl(
					activeItem.boxContent,
					{ no_cache: now() }  // change the querystring
				).fullUrl;

				showItem( activeIndex, TRUE );
			}
		}  // reload


		function goBack () {
			// Reverts to the previous content.
			if ( previousItem ) {
				start( previousItem, { sameBox: TRUE } );
			}
		}  // goBack


		function end ( arg, phase ) {
			// Close down this floatbox.
			// arg:
			//   true to close all open boxes
			//   'self' to refresh page after box is gone,
			//   'back' to navigate page back in history list
			//   a url to navigate to that new page
			//   oncomplete callback
			var
				layout,
				noAnimation,
				timeout,
				thatBox,
				$host,
				nav,
				i;

			if ( !phase ) {  // phase 0

				if ( activeItem && thisBox.state > STATE_initial  // ignore duplicate end calls
					|| thisBox.fbSlowLoad.parentElement
				) {

					if ( animationStatus.active ) {  // wait for current animations to complete
						setTimer( [ end, arg ], 77, TIMER_end, boxTimeouts );
					}

					else if (  // run and check exit functions for the current item
						trigger( activeSettings.beforeItemEnd, thisBox ) !== FALSE
						&& trigger( boxSettings.beforeBoxEnd, thisBox ) !== FALSE
					) {
						thisBox.state = STATE_end;
						phase = 1;  // carry on ending
					}
				}
			}  // end phase 0

			if ( phase == 1 ) {

				for ( timeout in boxTimeouts ) {
					clearTimer( timeout, boxTimeouts );
				}

				// remove pageScroll settings
				if ( pageScrollDisabled ) {
					setStyle( topDoc.documentElement, [
						'marginRight', '',
						'overflow', ''
					] );
					topWin.scroll( viewport.left, viewport.top );
				}

				// don't animate an offscreen box nor a secondary when ending all
				layout = simpleLayout( $fbContentWrapper );
				noAnimation = !$fbContentWrapper.clientWidth
					|| boxIndex && arg === TRUE  // end all
					|| layout.left > viewport.width  // content left is right of viewport
					|| layout.top > viewport.height  // content top is below viewport
					|| layout.right < 0  // content right is left of viewport
					|| layout.bottom < 0;  // content bottom is above viewport

				// and don't animate a non-modal box that has siblings
				if ( !( isModal || noAnimation ) ) {
					i = instances.length;
					while ( i-- ) {
						thatBox = instances[ i ];
						if ( thatBox && thatBox != thisBox && thatBox.fbMain && !thatBox.isModal ) {
							noAnimation = TRUE;
						}
					}
				}

				if ( noAnimation ) {
					resizeTime = 0;
					setStyle( $fbMain, 'display', 'none' );
				}

				// zoom out if this box zoomed in
				zoomer = zoomer && resizeTime && ifNotSet(
					activeSettings.zoomSource,
					activeItem.isImage && activeItem.boxContent || zoomer
				);

				// animated (or quick) end starts here
				setFixed( FALSE );  // turn off fixed positioning for a consistent coordinate space
				if ( shadowSize ) {  // turn off shadows
					shadowSize = 0;
					setBoxShadow();
				}

				// determine endPos (but call it startPos)
				$host =
					getOwnerWindow( activeItem.hostEl )  // avoid elements in an IE tombstoned document
					&& activeItem.hostEl;
				popupShow( $host );  // put popup back so we can zoom out to it (if there is one)
				startPos = getAnimationOrigin( endAt == 'start' ? startItem : activeItem, zoomer );
				popupHide( $host );
				if ( !endAt && !startPos.width ) {
					// item was off-screen, but maybe the starter isn't
					startPos = getAnimationOrigin( startItem, zoomer );
				}

				// zoom out, maybe to a thumbnail
				if ( zoomer ) {
					zoomOut( [ end, arg, 2 ] );
				}

				// if not zooming, animate down to zero
				else {
					collapse( function () {

						setStyle( [
								$fbLiner,
								thisBox.fbHeader,
								thisBox.fbFooter,
								thisBox.fbOuterClose
							],
							'display', 'none'
						);
						placeElement( $fbContent );  // will silence a playing video

						if ( splitResize ) {  // split animate down to small box size
							layout = simpleLayout( $fbMain );
							boxAnimate( [ 'fbMain',
									layout.x - smallBoxSize / 2 - outerBorder + viewport.left,
									layout.y - smallBoxSize / 2 - outerBorder + viewport.top,
									smallBoxSize,
									smallBoxSize
								],
								0,
								resizeTime,
								layout.width < layout.height ? 'x' : 'y'
							);
						}

						boxAnimate( [ 'fbMain',
								startPos.left + startPos.width / 2,
								startPos.top + startPos.height / 2,
								0,
								0
							],
							[ end, arg, 2 ],
							resizeTime
						);
					} );
				}
			}  // end phase 1

			if ( phase == 2 ) {

				setStyle( $fbMain, 'display', 'none' );
				thisBox.fbFloater.src = zoomer || blankGif;
				putInlineBack( activeItem );  // move content and captions back to host page

				if ( $fbOverlay ) {
					boxAnimate( [ 'fbOverlay', 'opacity', 0 ],
						[ end, arg, 3 ],
						overlayFadeTime
					);
				}
				else {
					phase = 3;  // fall through
				}
			}  // end phase 2

			if ( phase == 3 ) {
			// post-overlay-fadeout

				setStyle( $fbOverlay, 'display', 'none' );

				if ( zoomer ) {
					boxAnimate( [ 'fbFloater', 'opacity', 0 ],
						[ end, arg, 4 ],
						0.3
					);
				}
				else {
					phase = 4;  // fall through
				}
			}  // end phase 3

			if ( phase == 4 ) {

				thisBox.fbFloater.src = blankGif;
				trigger( activeSettings.afterItemEnd );
				destroy();  // caution: thisBox is null after this
				if ( activeItem.originalBoxContent ) {
					activeItem.boxContent = activeItem.originalBoxContent;  // from reload()
				}
				trigger( boxSettings.afterBoxEnd );

				// callback passed in
				if ( arg && arg.call ) {
					trigger( arg );
				}

				// end all, close topBox
				thatBox = arg === TRUE && getInstance();
				if ( thatBox ) {
					thatBox.end( arg );
				}

				// loadPageOnClose request
				nav = ''+arg === arg && arg
					|| activeSettings.loadPageOnClose
					|| boxSettings.loadPageOnClose;
				if ( nav == 'self' ) {
					topWin.location.reload( TRUE );
				}
				else if ( nav == 'back' ) {
					topWin.history.back();
				}
				else if ( nav ) {
					topWin.location.href = nav;
				}
			}  // end phase 4

		}  // end

		/// end Box api methods

		/// begin Box service methods

		function boot ( reboot, item, startSettings ) {
			// Light up the box, called from fb.start.
			// 'reboot' if it's a sameBox restart.
			var img;

			// run and check the startup callbacks
			if ( !reboot && trigger( startSettings.beforeBoxStart ) === FALSE
				|| trigger( startSettings.beforeItemStart, thisBox ) === FALSE
			) {  // never mind
				if ( !reboot ) {
					destroy();
				}
			}
			else {  // proceed

				getCurrentSet( item, startSettings );  // sets activeIndex too
				if ( !itemCount ) {  // bail if we didn't find anything to show
					if ( !reboot ) {
						destroy();
					}
				}
				else {  // proceed

					thisBox.state = STATE_initial;
					isTooltip = item.isTooltip;
					isContip = item.isContip;
					previousItem = activeItem;  // undefined if this isn't a sameBox:true request
					previousIndex = activeIndex;
					previousSettings = activeSettings;
					thisBox.activeItem = activeItem = currentSet[ activeIndex ];
					activeSettings = startSettings;

					if ( reboot ) {  // samebox: gracefully terminate the previous item
						putInlineBack( previousItem );
						trigger( previousSettings.afterItemEnd );
					}

					else {  // configure the new box

						startItem = activeItem;  // so we can animate out to the starting location
						if ( tapDetails.eType ) {
							startTapX = tapDetails.tapX;
							startTapY = tapDetails.tapY;
						}

						getBoxSettings();  // activeItem and activeSettings must already be established

						if ( parentBox ) {  // stop parent's slideshow
							parentBox.pause( TRUE );
						}

						if ( isModal ) {
							restrictTabNav();
							// restrict touchmove panning to our own handler (removed in destroy)
							setStyle( topDoc.documentElement, 'touchAction', 'pinch-zoom' );
						}

						assembleBox();  // create and configure DOM elements
						addEventHandlers();

						// start the overlay fade
						if ( $fbOverlay ) {
							img = boxSettings.overlayBackgroundImage;
							setStyle( $fbOverlay, [
								'backgroundColor', overlayColor,
								'backgroundImage', img ? 'url(' + img + ')' : '',
								'visibility', '',
								'opacity', 0
							] );
							boxAnimate( [ 'fbOverlay', 'opacity', overlayOpacity ],
								0,
								overlayFadeTime
							);
						}
					}
					launchItem();
				}
			}
		}  // boot


		function getCurrentSet ( startItem, startSettings ) {
			// Populate the currentSet array with items from this group.
			var
				randomOrder = startSettings.randomOrder,
				item,
				itemSettings,
				i;

			justImages = TRUE;
			hasImage = FALSE;
			currentSet.length = 0;  // in case it's a samebox:reboot

			for ( i = 0; i < items.length; i++ ) {
				if ( ( item = items[ i ] ) ) {
					itemSettings = item.itemSettings;

					if ( item.canShow && (
						item == startItem
						|| item.ownerBox === TRUE
						|| itemSettings.group
						&& itemSettings.group == startSettings.group
						&& item.hostEl
						&& nodeContains( item.hostEl.ownerDocument, item.hostEl )  // still present
					) ) {

						currentSet.push( item );  // add it to the item array for this run
						item.seen = FALSE;  // for the slideshow counter
						item.setOrder = randomOrder ? mathRandom( bigNumber )
							: itemSettings.order || currentSet.length;

						if ( item.ownerBox === TRUE ) {  // API start
							item.ownerBox = thisBox;  // so it will clean up when this box is destroyed
							item.setOrder = -item.setOrder;  // goes to the front of the set
						}

						if ( item.isImage ) {
							hasImage = TRUE;
						}
						else {
							justImages = FALSE;
						}
					}
				}
			}

			itemCount = currentSet.length;
			if ( itemCount ) {  // set activeIndex (might not be startItem)
				currentSet.sort( function ( a, b ) {
					return a.setOrder - b.setOrder;
				} );
				activeIndex = randomOrder ? 0 : itemCount - 1;
				while ( activeIndex && currentSet[ activeIndex ] != startItem ) {
					activeIndex--;
				}
			}
		}  // getCurrentSet


		function getBoxSettings () {
			// Assign per box settings to this instance and tweak contingent settings.
			var
				itemSettings,
				setting,
				i;

			// activeItem and activeSettings were assigned in boot
			boxSettings = extend( activeSettings );

			enableDragMove = boxSettings.enableDragMove !== FALSE;
			draggerLocation =
				usingTouch || !boxSettings.enableDragResize ? OPT_none
				: justImages && boxSettings.draggerLocation == 'content' ? OPT_two
				: OPT_one;  // in the frame
			boxRadius = ifNotSet( boxSettings.boxCornerRadius, 8 );
			shadowType = boxSettings.shadowType || 'drop';
			shadowSize = shadowType == 'none' ? 0 : ifNotSet( boxSettings.shadowSize, 12 );
			shadowOpacity = ifNotSet( boxSettings.shadowOpacity, 0.4 );
			outerBorder = mathCeil( ifNotSet( boxSettings.outerBorder, 1 ) );  // must be an integer
			outerBorderX2 = outerBorder * 2;
			innerBorder = mathCeil( ifNotSet( boxSettings.innerBorder, 1 ) );
			innerBorderX2 = innerBorder * 2;
			padding = ifNotSet( boxSettings.padding, 20 );
			panelPadding = ifNotSet( boxSettings.panelPadding, 6 );
			overlayOpacity = isModal ? ifNotSet( boxSettings.overlayOpacity, 0.55 ) : 0;
			transitionTime = ifNotSet( boxSettings.transitionTime, 0.8 );
			imageTransition = boxSettings.imageTransition;
			overlayFadeTime = overlayOpacity && ifNotSet( boxSettings.overlayFadeTime, 0.4 );
			resizeTime = ifNotSet( boxSettings.resizeTime, 0.7 );
			fadeTime = ifNotSet( boxSettings.fadeTime, 0.4 );
			inFrameResize = boxSettings.inFrameResize !== FALSE;
			endAt = boxSettings.endAt;
			splitResize = resizeTime && boxSettings.splitResize;
			smallBoxSize = mathMax( 120 - outerBorderX2, 70 );
			zoomer = resizeTime && ifNotSet( boxSettings.zoomSource,
				activeItem.isImage && activeItem.boxContent
			);
			zoomBorder = ifNotSet( boxSettings.zoomBorder, 1 );
			autoFitSpace = ifNotSet( boxSettings.autoFitSpace, 5 );
			showHints = boxSettings.showHints;
			stickyMove = boxSettings.stickyMove !== FALSE;
			stickyResize = boxSettings.stickyResize !== FALSE;
			showClose = boxSettings.showClose !== FALSE;
			outerClosePos = boxSettings.outerClosePos || 'tr';
			showControlsText = boxSettings.showControlsText !== FALSE;
			enableKeyboardNav = boxSettings.enableKeyboardNav !== FALSE;

			// color theme definitions
			setting =
				{  // overlay, box, outerBorder, innerBorder, text, strongText
					black: [ 'black', 'black', '#888', '#ccc', '#aaa', '#ddd' ],
					blue: [ '#124', '#0b183b', '#777', '#9ab', '#aaa', '#ddd' ],
					white: [ 'black', 'white', '#555', 'black', '#555', 'black' ],
					yellow: [ '#bbb', '#ed9', '#611', '#733', '#733', '#600' ],
					red: [ '#211', '#511', '#865', '#965', '#ca8', '#eca' ]
				}[
					boxSettings.colorTheme
					|| activeItem.isImage && 'black'
					|| activeItem.isVideo && 'blue'
				]
				|| [ 'black', '#ccc', 'black', 'black', '#444', 'black' ];  // default silver

			overlayColor = boxSettings.overlayColor || setting[ 0 ];
			boxColor = boxSettings.boxColor || setting[ 1 ];
			outerBorderColor = boxSettings.outerBorderColor || setting[ 2 ];
			innerBorderColor = boxSettings.innerBorderColor || setting[ 3 ];
			textColor = boxSettings.textColor || setting[ 4 ];
			strongTextColor = boxSettings.strongTextColor || setting[ 5 ];

			// gallery settings
			if ( itemCount > 1 ) {
				setting = boxSettings.navType;  // from option ...
				setting = setting == 'none' ? OPT_none  // ... to bitmap
					: setting == 'button' ? OPT_one
					: setting == 'overlay' ? OPT_two
					: setting == 'both' ? OPT_both
					: justImages ? OPT_both
					: OPT_one;
				navButton = setting & OPT_one;
				navOverlay = setting & OPT_two;
				setting = boxSettings.showNavOverlay;
				showNavOverlay = !!setting === setting ? setting : usingTouch || OPT_default;
				enableSwipeNav = boxSettings.enableSwipeNav !== FALSE;
				enableWrap = boxSettings.enableWrap !== FALSE;
				numIndexLinks = boxSettings.numIndexLinks;
				indexPos = boxSettings.indexPos || 'br';
				isSlideshow = boxSettings.doSlideshow;
				showPlayPause = isSlideshow && boxSettings.showPlayPause !== FALSE;
				isPaused = boxSettings.startPaused;
				hasItemNumber = boxSettings.showItemNumber !== FALSE;
			}

			// position a couple of widgets
			controlsPos =
				( showClose || showPlayPause || navButton )
				&& ( boxSettings.controlsPos || 'br' );
			resizeTool = boxSettings.resizeTool;
			resizeTool = resizeTool == 'top' + 'left' || boxSettings.contentClickCloses
				? OPT_two
				: resizeTool == 'both' || usingTouch || isMac && !isWebkit
				? OPT_both  // most mac browsers don't do custom cursors, but try anyway
				: OPT_one;  // default is cursor only

			// animation tweaks
			if ( boxSettings.doAnimations === FALSE ) {
				resizeTime = fadeTime = transitionTime = overlayFadeTime = 0;
			}
			imageTransition = !transitionTime || imageTransition == 'none' ? OPT_none
				: imageTransition == 'slide' ? OPT_slide
				: imageTransition == 'expand' ? OPT_expand
				: imageTransition == 'shift' ? OPT_shift
				: imageTransition == 'fade' ? OPT_fade
				: OPT_crossfade;
			if ( imageTransition == OPT_none ) {
				transitionTime = 0;
			}

			// gradients are requested as a pair of boxColor values, like #112233|#aabbcc
			if ( /\|/.test( boxColor ) ) {
				gradientColors = boxColor.split( '|' );
			// average the two gradient colors for fallback
				setting = +patch( gradientColors[ 0 ], '#', '0x' );
				setting += +patch( gradientColors[ 1 ], '#', '0x');
				boxColor = '#' + ( setting / 2).toString( 16 );
			}

			// figure out what components we have in the current set
			i = itemCount;
			while ( i-- ) {
				itemSettings = currentSet[ i ].itemSettings;
				hasCaption = hasCaption || itemSettings.caption;
				hasCaption2 = hasCaption2 || itemSettings.caption2;
				hasInfo = hasInfo || itemSettings.info;
				hasPrint = hasPrint || !currentSet[ i ].isXSite && itemSettings.showPrint;
				hasNewWindow = hasNewWindow || itemSettings.showNewWindow;
				hasHeader = hasHeader || itemSettings.header;
				hasFooter = hasFooter || itemSettings.footer;
			}

			// expose some settings
			extend( thisBox, {
				outerClickCloses: ifNotSet( boxSettings.outsideClickCloses, isModal ),  // for tapHandler
				name: ( boxSettings.instanceName || activeItem.boxName ) + '',  // for fb.getInstance
				isSlideshow: isSlideshow,  // for messageHandler
				itemCount: itemCount  // for messageHandler
			} );

			preload( zoomer );  // get it ready
		}  // getBoxSettings


		function restrictTabNav () {
			// Limit (most) tab navigation to the modal box and contents.
			var i;

			tabRestrictions = fb.select( '*' );  // '*' because firefox tabs to all scrollable elements
			i = tabRestrictions.length;
			while ( i-- ) {
				tabIndices[ i ] = attr( tabRestrictions[ i ], 'tabindex' );
				attr( tabRestrictions[ i ], 'tabindex', -1 );
			}
		}  // restrictTabNav


		function assembleBox () {
			// Assemble floatbox elements roughly like the following:
			//  <img name="fbFloater" />  (initially unattached)
			//  <img name="fbSlowLoad" />  (initially unattached)
			//  <div name="fbOverlay"></div>
			//  <div name="fbMain">
			//    <div name="fbHeader"></div>
			//    <div name="fbFooter"></div>
			//    <a name="fbOuterClose"></a>
			//    <div name="fbBackground"></div>
			//    <div name="fbLiner">
			//      <div name="fbTopPanel">
			//        <span name="fbCell_tl">  (panel contents vary depending on placement options)
			//          <span name="fbCaption2"></span>
			//          <span name="fbWidgets_tl"></span>  (maybe)
			//        </span>
			//        <span name="fbCell_tc">
			//          <span name="fbWidgets_tc"></span>  (maybe)
			//        </span>
			//        <span name="fbCell_tr">
			//          <a name="fbNewWindow"></a>
			//          <span name="fbWidgets_tr"></span>  (maybe)
			//        </span>
			//      </div>
			//      <div name="fbContentWrapper">
			//        <div|img|iframe name="fbContent" />
			//        <a name="fbPrevPanel"></a>
			//        <a name="fbNextPanel"></a>
			//        <a name="fbPrev2"></a>
			//        <a name="fbNext2"></a>
			//        <span name="fbResizer"></span>
			//      </div>
			//      <div name="fbBottomPanel">
			//        <span name="fbCell_bl">  (panel contents vary depending on placement options)
			//          <span name="fbCaption"></span>
			//          <span name="fbWidgets_bl">  (maybe)
			//            <a name="fbInfo"></a>
			//            <a name="fbPrint"></a>
			//            <span name="fbItemNumber"></span>
			//          </span>
			//        </span>
			//        <span name="fbCell_bc">
			//          <span name="fbWidgets_bc"></span>  (maybe)
			//        </span>
			//        <span name="fbCell_br">
			//          <span name="fbIndex"></span>
			//          <span name="fbWidgets_br"></span>  (maybe)
			//          <span name="fbControls">
			//            <span name="fbNav">
			//              <a name="fbPrev"></a>
			//              <a name="fbNext"></a>
			//            </span>
			//            <span name="fbPlayPause">
			//              <a name="fbPlay"></a>
			//              <a name="fbPause"></a>
			//            </span>
			//            <a name="fbClose"></a>
			//          </span>
			//        </span>
			//      </div>
			//      <div name="fbDragger"></div>
			//    </div>
			//  </div>
			var
				pos,
				$attachTo,
				$fbControls;

			newBoxPart( 'fbFloater', 0, 'img' );
			newBoxPart( 'fbSlowLoad', 0, 'img' );
			if ( overlayOpacity ) {
				$fbOverlay = newBoxPart( 'fbOverlay' );
			}

			$fbMain = newBoxPart( 'fbMain' );
			if ( hasHeader ) {
				newBoxPart( 'fbHeader', $fbMain );
			}
			if ( hasFooter ) {
				newBoxPart( 'fbFooter', $fbMain );
			}
			if ( boxSettings.showOuterClose ) {
				newBoxPart( 'fbOuterClose', $fbMain, 'a', STR_close, 'close' + 2 );
			}

			newBoxPart( 'fbBackground', $fbMain );
			$fbLiner = newBoxPart( 'fbLiner', $fbMain );

			$attachTo = newBoxPart( 'fbTopPanel', $fbLiner );
			newBoxPart( 'fbCell_tl', $attachTo, 'span' );
			newBoxPart( 'fbCell_tc', $attachTo, 'span' );
			newBoxPart( 'fbCell_tr', $attachTo, 'span' );

			$fbContentWrapper = newBoxPart( 'fbContentWrapper', $fbLiner );

			if ( navOverlay ) {
				newBoxPart( 'fbPrevPanel', $fbContentWrapper, 'a' );
				newBoxPart( 'fbNextPanel', $fbContentWrapper, 'a' );
				newBoxPart( 'fbPrev2', $fbContentWrapper, 'a', STR_prev, 'prev' + 2 );
				newBoxPart( 'fbNext2', $fbContentWrapper, 'a', STR_next, 'next' + 2 );
			}

			if ( hasImage && boxSettings.enableImageResize !== FALSE ) {
				newBoxPart( 'fbResizer', $fbContentWrapper, 'span', STR_resize, 'zoom' );
			}

			$attachTo = newBoxPart( 'fbBottomPanel', $fbLiner );
			newBoxPart( 'fbCell_bl', $attachTo, 'span' );
			newBoxPart( 'fbCell_bc', $attachTo, 'span' );
			newBoxPart( 'fbCell_br', $attachTo, 'span' );

			// indexLinks are next to fbContent when in bottom panel, re-ordered below when in the top
			if ( numIndexLinks ) {
				newBoxPart( 'fbIndex', thisBox[ 'fbCell_' + indexPos ], 'span' );
			}

			if ( controlsPos ) {
				$fbControls = newBoxPart( 'fbControls', thisBox[ 'fbCell_' + controlsPos ], 'span' );
				pos = smallScreen && !showControlsText? 3 : '';
				if ( navButton ) {
					$attachTo = newBoxPart( 'fbNav',
						boxSettings.centerNav
							? thisBox[ 'fbCell_' + patch( controlsPos, /[lr]/, 'c' ) ]
							: $fbControls,
						'span'
					);
					newBoxPart( 'fbPrev', $attachTo, 'a', STR_prev, 'prev' + pos, 'Right' );
					newBoxPart( 'fbNext', $attachTo, 'a', STR_next, 'next' + pos, 'Left' );
				}
				if ( showPlayPause ) {
					$attachTo = newBoxPart( 'fbPlayPause', $fbControls, 'span' );
					newBoxPart( 'fbPlay', $attachTo, 'a', STR_play, 'play', 'Left' );
					newBoxPart( 'fbPause', $attachTo, 'a', STR_pause, 'pause', 'Left' );
				}
				if ( showClose ) {
					newBoxPart( 'fbClose',
						$fbControls,
						'a',
						STR_close,
						'close' + ( showControlsText ? '' : 3 ),
						'Left'
					);
				}
			}

			if ( hasCaption2 ) {
				newBoxPart( 'fbCaption2',
					thisBox[ 'fbCell_' + ( boxSettings.caption2Pos || 'tc' ) ],
					'span'
				);
			}
			if ( hasCaption ) {
				newBoxPart( 'fbCaption',
					thisBox[ 'fbCell_' + ( boxSettings.captionPos || 'bl' ) ],
					'span'
				);
			}
			if ( hasInfo ) {
				pos = boxSettings.infoLinkPos || 'bl';
				newBoxPart( 'fbInfo',
					newBoxPart( 'fbWidgets_' + pos,
						thisBox[ 'fbCell_' + pos ],
						'span'
					),
					'a',
					0,
					'info',
					'Right'
				);
			}
			if ( hasPrint ) {
				pos = boxSettings.printLinkPos || 'bl';
				newBoxPart( 'fbPrint',
					thisBox[ 'fbWidgets_' + pos ] || newBoxPart( 'fbWidgets_' + pos,
						thisBox[ 'fbCell_' + pos ],
						'span'
					),
					'a',
					0,
					'print',
					'Right'
				);
			}
			if ( hasItemNumber ) {
				pos = boxSettings.itemNumberPos || 'bl';
				newBoxPart( 'fbItemNumber',
					thisBox[ 'fbWidgets_' + pos ] || newBoxPart( 'fbWidgets_' + pos,
						thisBox[ 'fbCell_' + pos ],
						'span'
					),
					'span'
				);
			}
			if ( hasNewWindow ) {
				pos = boxSettings.newWindowLinkPos || 'tr';
				newBoxPart( 'fbNewWindow',
					thisBox[ 'fbWidgets_' + pos ] || newBoxPart( 'fbWidgets_' + pos,
						thisBox[ 'fbCell_' + pos ],
						'span'
					),
					'a',
					0,
					'newWindow',
					'Right'
				);
			}
			if ( draggerLocation ) {
				newBoxPart( 'fbDragger',
					draggerLocation == OPT_one ? $fbLiner : $fbContentWrapper,
					'div',
					0,
					'dragger'
				);
			}

			// re-order controls if on the left and move to the bottom if in the bottom panel
			if ( /l/.test( controlsPos ) ) {
				placeElement( thisBox.fbPlayPause, $fbControls );
				placeElement( thisBox.fbNav, $fbControls );
			}
			if ( /b/.test( controlsPos ) ) {
				placeElement( $fbControls, $fbControls.parentElement );
			}

			// place top panel index links closest to content
			if ( numIndexLinks && /t/.test( indexPos ) ) {
				placeElement( thisBox.fbIndex, thisBox.fbIndex.parentElement );
			}

			// attach to the bottom of the body
			$attachTo = topDoc.body;
			placeElement( $fbOverlay, $attachTo );
			placeElement( $fbMain, $attachTo );

			configureBox();

		}  // assembleBox


		function newBoxPart ( fbName, $parent, tagName, title, icon, iconTextSide ) {
			// Create a box element.
			var $el;

			if ( fbName ) {
				$el = thisBox[ fbName ] = newElement( tagName || 'div' );

				title = title && strings[ title ] || '';  // needed for icon control text too
				if ( title
					&& enableKeyboardNav
					&& showHints !== FALSE
					&& !offHints[ fbName ]
				) {
					$el.title = title;
				}

				if ( icon ) {
					icon = newElement( 'i', icons[ icon ] );
					addClass( icon, 'fbIcon' );

					if ( iconTextSide ) {  // there is, or will be, text on this control or widget
						$el.innerHTML = makeOuterHtml( 'span',
							// first word of title string
							showControlsText ? /\S*/.exec( title )[ 0 ] : '',
							[ 'class', 'fbText' ]
						);
						setStyle( icon, 'padding' + iconTextSide, '.5em' );  // add padding on text side
					}
					placeElement( icon, $el, iconTextSide == 'Right' && $el.firstChild );
					boxEvents.push(
						addEvent( $el, [ 'onmouseover', 'onmouseout' ], highlightHandler )
					);
					setStyle( $el, 'color', textColor );
				}

				$el.fbName = fbName;
				addClass( $el, [
					'fbx',
					fbName,
					/_/.test( fbName ) && fbName.split( '_' )[ 0 ]  // fbCell_* gets the fbCell class
				] );
				setStyle( $el, [  // override some user css settings that can mess us up
					'boxSizing', 'content-box',
					'transitionDuration', '0s'
				] );

				// <a>
				if ( tagName == 'a' ) {
					$el.href = '';  // needs href to be tappable on mobile devices
					boxEvents.push(
						addEvent( $el, 'onclick', stopEvent )  // prevent default link navigation
					);
				}

				// <iframe>
				if ( tagName == 'iframe' ) {
					attr( $el, objectify(
						'allowFullScreen', '', // html5 full-screen mode (not case-sensitive)
						'allow', 'autoplay',  // avoid muted video requirement for autoplay
						// scrolling and frameBorder are deprecated but have no good css alternative
						'scrolling', isIos ? 'no'
							: patch( overflow, 'hidden', 'no', 'scroll', 'yes' ),
						'frameBorder', 0
					) );

					$el.src = aboutBlank;  // code can check src value to see if the iframe is live yet
				}

				// <img>
				if ( tagName == 'img' ) {
					$el.alt = '';  // 508 compliance
					$el.src = blankGif;  // else firefox might show a brief broken icon
				}

				// add element references to box and fb
				thisBox[ fbName ] = $el;
				nodeNames.push( fbName );  // keep a record of created nodes for destroy

				if ( $parent ) {
					placeElement( $el, $parent );
				}

				return $el;
			}
		}  // newBoxPart


		function configureBox () {
			// Set initial state for various box bits.
			var
				zoomFromThumb = zoomer && activeItem.thumbEl,
				$fbOuterClose = thisBox.fbOuterClose,
				setting;

			// set starting metrics
			// top/left is outside outerBorder
			// width/height is box size inside outerBorder
			startPos = getAnimationOrigin(
				zoomFromThumb ? activeItem : startItem,
				zoomer,
				TRUE
			);
			if ( zoomFromThumb && !startPos.width ) {
				// item was off-screen, but maybe the starter isn't
				startPos = getAnimationOrigin( startItem, zoomer, TRUE );
			}

			// color and background requests
			// (icon'd widget color was set at newBoxPart creation time)

			// take care of captions, info and print via inheritance from the panels
			setStyle( [
					thisBox.fbTopPanel,
					thisBox.fbBottomPanel
				],
				'color', strongTextColor
			);
			setStyle( [
					thisBox.fbItemNumber,
					thisBox.fbNewWindow
				],
				'color', textColor
			);
			setStyle( $fbMain, 'borderColor', outerBorderColor );
			setStyle( $fbContentWrapper, 'borderColor', innerBorderColor );

			setting = boxSettings.boxBackgroundImage;

			setStyle( thisBox.fbBackground, [
				'backgroundColor', boxColor,
				'backgroundImage', setting ? 'url(' + setting + ')'
					: gradientColors ? 'linear-gradient(' + gradientColors.join( ',' ) + ')'
					: ''
			] );

			// misc element styles

			setStyle( [
					$fbOverlay,
					$fbMain,
					$fbOuterClose,
					$fbLiner,
					thisBox.fbControls,
					thisBox.fbHeader,
					thisBox.fbFooter
				],
				'visibility', 'hidden'
			);

			setStyle( $fbMain, startPos );
			setStyle( $fbMain, [
				'borderWidth', outerBorder,
				'textAlign', 'left'  // over-ride inheritance from body
			] );

			setStyle( $fbContentWrapper, [
				'borderWidth', innerBorder,
				'direction', 'ltr'  // better image transitions on rtl pages
			] );

			if ( $fbOuterClose ) {
				setting = -outerBorder - $fbOuterClose.offsetWidth / 2;
				setStyle( $fbOuterClose, [
					'top', setting,
					outerClosePos == 'tr' ? 'right' : 'left', setting
				] );
				setStyle( select( 'circle', $fbOuterClose, 0 ), 'fill', boxColor );
			}

			if ( showPlayPause ) {
				setStyle( [
						thisBox.fbPlay,
						thisBox.fbPause
					],
					'width',
					mathMax(  // lock the largest width
						thisBox.fbPlay.offsetWidth,
						thisBox.fbPause.offsetWidth
					)
				);
				setStyle( thisBox[ isPaused ? 'fbPause' : 'fbPlay' ],  // hide one of 'em
					'display', 'none'
				);
			}

			// round corners
			setBorderRadius( $fbMain, boxRadius, UNDEFINED, TRUE );
			if ( ( setting = boxSettings.contentCornerRadius ) ) {
				setBorderRadius( $fbContentWrapper, setting );
			}

			// square the round corner that has visible fbDragger in it
			if ( draggerLocation ) {
				setting = draggerLocation == OPT_one;
				setBorderRadius(
					setting ? $fbMain : $fbContentWrapper,
					0,
					'Bottom',
					setting
				);
			}

			// set up fbFloater for zoomIn here so it can be above the overlay
			if ( zoomer ) {
				thisBox.fbFloater.src = zoomFromThumb && activeItem.thumbSrc || blankGif;
				setStyle( thisBox.fbFloater, startPos );
				setStyle( thisBox.fbFloater, 'borderWidth', zoomBorder );
				placeElement( thisBox.fbFloater, topDoc.body );
				popupLocked = TRUE;  // prevent mouseout closing popup thumb until zoomIn takes over
			}

			// make fbMain focusable
			attr( $fbMain, 'tabindex', -1 );

			// stack 'em
			setZIndex();

		}  // configureBox


		function setBoxShadow () {
			// Draw or remove css3 or vml shadows.
			var
				style = '',
				offset,
				blur,
				spread;

			if ( shadowSize ) {
				if ( shadowType == 'drop' ) {
					offset = 1;
					spread = -0.3;
				}
				else if ( shadowType == 'halo' ) {
					offset = 0;
					spread = 0.7;
				}
				else {  // hybrid
					offset = 0.25;
					spread = 0.45;
				}

				offset = mathFloor( offset * shadowSize );
				blur = mathFloor( 0.8 * shadowSize );
				spread = mathFloor( spread * shadowSize );

				style = [
					offset, offset,
					blur, spread,
					'rgba(0,0,0,' + shadowOpacity + ')'
				].join( 'px ' );
			}

			setStyle( $fbMain, 'boxShadow', style );

		}  // setBoxShadow


		function setZIndex () {
			// Set z-index for components of this box.
			var
				fbNames = [  // order from lower to higher
					'fbOverlay',
					'fbMain',
					'fbPrevPanel',
					'fbNextPanel',
					'fbPrev2',
					'fbNext2',
					'fbResizer',
					'fbFloater',
					'fbOuterClose',
					'fbDragger'
				],
				base = boxSettings.zIndex || bigNumber,  // 77777 is default
				i = fbNames.length;

			base += i * thisBox.stackOrder - i + 1;
			while ( i-- ) {  // setStyle will filter non-existent nodes
				setStyle( thisBox[ fbNames[ i ] ], 'zIndex', base + i );
			}
		}  // setZIndex


		function getMousedownHandler () {
			// touch/click/drag handler for all box components.
			// Wraps some closure vars around mousedown, mousemove, mouseup, and touch handlers.
			var
				eventQueue = [],
				touches, evt,
				$target, $docEl,
				$bodStyle, bodCursor,
				startX, startY,
				dx, dy,
				boxX, boxY,
				boxW, boxH,
				contentX, contentY,
				contentWrapperWidth, contentWrapperHeight,
				minContentX, minContentY,
				dragMoving, dragResizing,
				inFrameDrag,
				swiping,
				moved,
				allowDefault,
				fbName,
				sum,
				scaled;

			function mousemoveHandler ( e ) {
				touches = e.touches;
				evt = touches ? touches[ 0 ] : e;
				allowDefault = touches && touches[ 1 ]  // ignore multi-touch
					|| evt.target.ownerDocument != topDoc;  // or in an iframe document

				if ( thisBox.state && $fbMain && !allowDefault ) {
					dx = evt.clientX - startX;  // current distance from the clicked location
					dy = evt.clientY - startY;

					if ( !moved && dx * dx + dy * dy > 9 ) {
						moved = TRUE;
						tapHandler();  // so mouseup won't trigger actions
						clearTimer( TIMER_slideshow, boxTimeouts );  // suspend slideshow activity
					}

					if ( moved ) {

						if ( inFrameDrag ) {  // move the in-frame resized image
							setStyle( $fbContent, [
								mathMax( mathMin( contentX + dx, 0 ), minContentX ),
								mathMax( mathMin( contentY + dy, 0 ), minContentY )
							] );
						}

						else if ( swiping ) {
							if ( !contentSwiped && mathAbs( dx ) > 50 ) {
								contentSwiped = TRUE;
								mouseupHandler();
								showItem( dx > 0 ? 'prev' : 'next' );
							}
						}

						else if ( dragResizing ) {

							// initialize on first handled move event
							if ( thisBox.state != STATE_resize ) {
								thisBox.state = STATE_resize;
								if ( activeItem.isImage ) {  // undo inframe-resizing
									setStyle( $fbContent, [ 0, 0, '100%', '100%' ] );
								}
								collapse();
								// get new offsets, collapse will reposition fixed to absolute
								boxX = $fbMain.offsetLeft;
								boxY = $fbMain.offsetTop;
							}

							// allocate mouse move deltas proportionately
							if ( sizeRatio ) {
								sum = dx + dy;
								dy = sum / ( sizeRatio + 1 );
								dx = sum - dy;  // the new dy
							}

							// enforce maxWidth/Height
							scaled = scale(
								contentWrapperWidth + dx * 2, contentWrapperHeight + dy * 2,
								maxWidth, maxHeight,
								sizeRatio, FALSE, -1
							);

							// and minWidth/Height
							scaled = scale(
								scaled.width, scaled.height,
								minWidth, minHeight,
								sizeRatio, TRUE, 1
							);
							dx = (scaled.width - contentWrapperWidth) / 2;
							dy = (scaled.height - contentWrapperHeight) / 2;

							// resize the box
							setStyle( $fbMain, [
								boxX - dx,
								boxY - dy,
								boxW + dx * 2,
								boxH + dy * 2
							] );
						}

						else if ( dragMoving ) {
							// move the box
							setStyle( $fbMain, [
								boxX + dx,
								boxY + dy
							] );
						}

						else {
							allowDefault = TRUE;
						}
					}

					if ( !allowDefault ) {
						stopEvent( e );
						// firefox can select document text when mouse moves occur outside of the target
						topWin.getSelection().removeAllRanges();
					}
				}

				// consider absence of movement a mouseup event
				// cancel the old and set a new one on each mousemove
				setTimer( mouseupHandler, 2222, TIMER_mouseup, boxTimeouts );

			}  // mousemoveHandler

			function mouseupHandler ( e ) {

				clearTimer( TIMER_mouseup, boxTimeouts );  // cancel the inactivity timer
				while ( eventQueue.length ) {
					removeEvent( eventQueue.pop() );  // unregister the event handlers
				}
				$bodStyle.cursor = bodCursor;

				if ( thisBox.state ) {

					if ( moved ) {

						if ( dragResizing ) {
							appliedMetrics.left -= dx;
							appliedMetrics.top -= dy;
							appliedMetrics.width += dx * 2;
							appliedMetrics.height += dy * 2;
							deltaMetrics.width += dx * 2;
							deltaMetrics.height += dy * 2;
							calcSize( FALSE, 0 );
							postResize();
						}

						else if ( dragMoving ) {
							appliedMetrics.left += dx;
							appliedMetrics.top += dy;
							deltaMetrics.left += dx;
							deltaMetrics.top += dy;
						}
					}

					// not moved, check for click actions to process
					else if ( e && tapDetails.eType ) {
						boxHandler( e );  // will stop e if appropriate
					}
				}
			}  // mouseupHandler

			return function ( e ) {
				// The real mousedown handler.

				if ( thisBox.state == STATE_show
					&& ( usingTouch || !e.button )  // left-button is 0
				) {

					// capture some shared data
					touches = e.touches;
					evt = touches ? touches[ 0 ] : e;
					$target = evt.target;
					fbName = $target.fbName || '';
					$docEl = $target.ownerDocument.documentElement;
					$bodStyle = topDoc.body.style;
					bodCursor = $bodStyle.cursor;
					startX = evt.clientX;
					startY = evt.clientY;
					boxX = $fbMain.offsetLeft;
					boxY = $fbMain.offsetTop;
					boxW = $fbMain.clientWidth;
					boxH = $fbMain.clientHeight;
					contentX = $fbContent.offsetLeft;
					contentY = $fbContent.offsetTop;
					contentWrapperWidth = $fbContentWrapper.clientWidth;
					contentWrapperHeight = $fbContentWrapper.clientHeight;

					// always need the mouseup handler to check for click actions
					eventQueue.push( addEvent( $docEl,
						touches ? 'touchend' : 'mouseup',
						mouseupHandler
					) );

					// restack the clicked box to the top of the pile
					if ( !isModal && !isContip && fbName != 'fbHeader' && fbName != 'fbFooter' ) {
						restack();
					}

					// see if we want to monitor mouse moves for any reason
					inFrameDrag = swiping = contentSwiped = dragResizing = dragMoving = moved = FALSE;

					// resize dragger (must come before drag move and content checks)
					if ( nodeContains( thisBox.fbDragger, $target ) ) {
						$bodStyle.cursor = 'nw-resize';
						dragResizing = TRUE;
					}

					// actions on content
					else if ( nodeContains( $fbContentWrapper, $target ) ) {

						// move in-frame resized image
						minContentX = contentWrapperWidth - $fbContent.clientWidth;
						minContentY = contentWrapperHeight - $fbContent.clientHeight;

						if ( minContentX + minContentY < -4 ) {
							// image (or iOS HTML?) is currently scaled up inside fbContentWrapper
							inFrameDrag = TRUE;
						}
						else if ( activeItem.isImage ) {
							// swipe navigation for touch and box moving for mouse
							if ( touches && enableSwipeNav ) {
								swiping = TRUE;
							}
							else {
								dragMoving = enableDragMove;
							}
						}
					}

					// drag move on box elements
					else if ( enableDragMove
						&& /^fb/.test( fbName )  // leave the mouse alone for elements inside captions
						&& !nodeContains( thisBox.fbHeader, $target )
						&& !nodeContains( thisBox.fbFooter, $target )
						&& !getTagName( $target, 'object' )
							// plugins on the mac are (were?) propagating mouse actions
					) {
						dragMoving = TRUE;
					}

					if ( inFrameDrag || swiping || dragResizing || dragMoving ) {

						// register move handler
						eventQueue.push( addEvent( $docEl,
							touches ? 'touchmove' : 'mousemove',
							mousemoveHandler,
							touches && { passive: FALSE }
						) );
					}
				}
			};  // mousedownHandler
		}  // getMousedownHandler


		function addEventHandlers () {
			// Add event handlers to the box components.

			boxEvents.push(

				// highlighter didn't get assigned to the nav panels in newBoxPart
				// because they don't have an fbIcon child
				addEvent( [ thisBox.fbPrevPanel, thisBox.fbNextPanel ], [
						'onmouseover',
						'onmouseout'
					],
					highlightHandler
				),

				// click actions for all widgets
				// drag for box moves and resizes
				// in-frame resized moves, swipe nav, and restacking for multiple non-modal boxes
				addEvent( $fbMain, [ 'ontouchstart', 'onmousedown' ], getMousedownHandler() ),

				// can't use the mouseHandler for newWindow because firefox on android
				// will block it if called from fbMain's touchend
				addEvent( thisBox.fbNewWindow, 'onclick', function ( e ) {
					var win = getOwnerWindow( $fbContent.contentWindow );
					if ( tapDetails.eType
						&& newWindow( win && win.location.href
							|| $fbContent.src != aboutBlank && $fbContent.src
							|| this.href
						)
						&& activeSettings.closeOnNewWindow
					) {
						end();
					}
					stopEvent( e );
				} ),

				// put handler on tooltip boxes so that mouse events on it behave similarly
				// to mouse events on the host element
				isTooltip && addEvent( $fbMain, [ 'mouseover', 'mouseout' ], contipHandler )
			);

			// keyboard handler is not per box and stays in play as long as any box is open
			if ( !boxIndex ) {
				firstEvents.push(  // will be removed with the last box
					addEvent( topDoc, 'keydown', keydownHandler )
				);
			}
		}  // addEventHandlers


		function boxHandler ( e ) {
			// fbMain.onclick replacement for touchend, mouseup and enter key.
			var
				$target = e.target,
				handled = TRUE,  // a starting assumption
				fbName;

			if ( $target && tapDetails.eType && ( !usingTouch || e.type != 'mouseup' ) ) {

				if ( !$target.fbName && !getTagName( $target, 'a' ) ) {  // <a> for index links
					$target = $target.parentElement || $target;
				}
				fbName = $target.fbName || '';

				if ( fbName.indexOf( 'fbPrev' ) == 0 ) {
					showItem( 'prev' );
				}

				else if ( fbName.indexOf( 'fbNext' ) == 0 ) {
					showItem( 'next' );
				}

				else if ( fbName == 'fbPlay' ) {
					pause( FALSE );
				}

				else if ( fbName == 'fbPause' ) {
					pause( TRUE );
				}

				else if ( fbName == 'fbResizer' || fbName == 'fbContent' && $target.style.cursor ) {
					resizeHandler( e );
				}

				else if ( fbName == 'fbInfo' ) {
					start( thisBox.fbInfo );
				}

				else if ( fbName == 'fbPrint' ) {
					printNode( $fbContent, activeSettings.printCSS, activeSettings );
				}

				else if (  // must check the overlay nav and resizer before this
					/Close/.test( fbName )
					|| activeSettings.contentClickCloses
					&& nodeContains( $fbContentWrapper, $target )
				) {
					end();
				}

				else {
					handled = FALSE;  // don't cancel the event if it wasn't handled
				}

				if ( handled ) {
					stopEvent( e );
				}
			}
		}  // boxHandler


		function keydownHandler ( e ) {
			var
				keyCode = e.keyCode,
				modKey = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey,
				topBox = getInstance();

			if ( isMac && modKey && ( keyCode == 38 || keyCode == 40 ) ) {
				// smaller macs can use any mod key + up/dn arrows instead of pgup/dn
				keyCode = keyCode == 38 ? 33 : 34;
				modKey = FALSE;
			}

			// process keystrokes in the context of the top-most box
			if ( thisBox != topBox ) {
				if ( topBox && topBox.state ) {
					topBox.keydownHandler( e );
				}
			}

			else if ( enableKeyboardNav
				&& thisBox.state
				&& !modKey
				&& getOwnerWindow( self )  // has thrown while browser is navigating away
				&& !getTagName( e.target, [ 'input', 'select', 'textarea' ] )
			) {

				// left/right arrow: prev/next item
				if ( ( keyCode == 37 || keyCode == 39 ) && itemCount > 1 ) {
					stopEvent( e );
					showItem( keyCode == 37 ? 'prev' : 'next' );
				}

				// spacebar: toggle play/pause
				else if ( keyCode == 32 && !activeItem.isHtml ) {
					stopEvent( e );
					pause( !isPaused );
				}

				// pgup pgdn: resize up or down
				else if ( keyCode == 33 || keyCode == 34 ) {
					stopEvent( e );
					resizeHandler( keyCode == 33 ? SIZE_large : SIZE_small );
				}

				// enter: accessible keyboard click
				else if ( keyCode == 13 ) {
					boxHandler( e );  // will stop e if appropriate
				}

				// esc: exit
				else if ( keyCode == 27 ) {
					stopEvent( e );
					end();
				}
			}
		}  // keydownHandler


		function highlightHandler ( e ) {
			// mouseover/out handler for various widgets.
			var
				$this = this,
				fbName = $this.fbName || '',
				nav = fbName.slice( 0, 6 ),  // !dependency on 6 char length of fbPrev and fbNext!
				on = e.type != 'mouseout',
				fbName2;

			// ignore mouseouts when going from the nav panels to the associated nav widgets
			if ( on || !nodeContains( thisBox[ nav + 2 ], e.relatedTarget ) ) {

				// overlay nav and resizer
				if ( nodeContains( $fbContentWrapper, $this ) ) {

					// toggle opacity for content widgets that show something ( not for nav panels )
					if ( $this.innerHTML ) {
						// save prior values
						$this.opacity = $this.opacity || getStyle( $this, 'opacity', TRUE );
						setStyle( $this, 'opacity', on ? 0.8 : $this.opacity );
					}

					if ( $this.href ) {  // fbResizer is a span

						// hide/reveal nav2 widgets on mouse hover
						if ( showNavOverlay === OPT_default ) {
							setStyle( thisBox[ nav + 2 ], 'visibility',
								on || !activeItem.isImage ? '' : 'hidden'
							);
						}

						// highlight nav1 widgets below
						$this = thisBox[ nav ];
					}

					else {
						$this = NULL;
					}
				}

				// text highlighting for icon fonts and various widget links
				if ( $this ) {

					on = $this.href && on;
					setStyle( $this, 'color',
						on ? strongTextColor : textColor
					);
					setStyle( getByClass( 'fbText', $this, 0 ), 'textDecoration',
						on ? 'underline' : ''
					);
				}

				// maybe remove title attributes to turn off the system tooltip keyboard nav hints
				if ( on && fbName && thisBox[ fbName ].title && showHints !== TRUE ) {

					setTimer( function () {
							fbName2 = objectify(  // shared title pairing map
								'fbClose', 'fbOuterClose',
								'fbOuterClose', 'fbClose',
								'fbPrev2', 'fbPrev',
								'fbNext2', 'fbNext',
								'fbPrev', 'fbPrev2',
								'fbNext', 'fbNext2'
							)[ fbName ] || fbName;

							offHints[ fbName ] = offHints[ fbName2 ] = TRUE;
							attr( [ thisBox[ fbName ], thisBox[ fbName2 ] ], 'title', NULL );
						},
						1777, fbName, boxTimeouts
					);
				}

				else {
					clearTimer( fbName, boxTimeouts );
				}
			}
		}  // highlightHandler


		function resizeHandler ( e ) {
			// Image resize request from fbResizer, content click, or PgUp/Dn keys.
			var
				layout,
				inFrame,
				dx, dy;

			if ( sizeState != SIZE_native	&& sizeState != e ) {
				// keyboard handler passes in requests to size up or down

				clearTimer( TIMER_slideshow, boxTimeouts );  // suspend slideshow activity

				// currently reduced
				if ( sizeState == SIZE_small ) {

					if ( inFrameResize && autoFit ) {  // enlarge, centered at the click
						layout = simpleLayout( $fbContent );

						if ( e.target == $fbContent && tapDetails.eType ) {
							// if we have a content click...
							layout.x = tapDetails.tapX;
							layout.y = tapDetails.tapY;
							// ...use the click coords as the resize center point
						}

						// current delta from native size
						dx = layout.width - nativeWidth;
						dy = layout.height - nativeHeight;

						// resize center point
						dx = mathMax( dx, mathMin( 0,
							dx / 2 - ( (layout.x - layout.left ) / layout.width - 0.5 ) * nativeWidth
						) );
						dy = mathMax( dy, mathMin( 0,
							dy / 2 - ( (layout.y - layout.top ) / layout.height - 0.5 ) * nativeHeight
						) );

						boxAnimate( [ 'fbContent',
								dx,
								dy,
								nativeWidth,
								nativeHeight
							],
							postResize,
							resizeTime
						);

						inFrame = TRUE;
					}
				}

				else {  // sizeState == SIZE_large
					inFrame = fitContent( postResize );
				}

				// resize to original request, auto-fitting as appropriate
				if ( !inFrame ) {
					thisBox.state = STATE_resize;
					appliedMetrics = {};
					deltaMetrics = objectify( zeroes );
					calcAppliedMetrics( [  // showContent will call postResize
						collapse,
						[ calcSize, sizeState == SIZE_large ]
					] );
				}
			}
		}  // resizeHandler


		function fitContent ( then ) {
			// Shrinks an inframeResized image back down to the contentWrapper size
			// and reports if it was super-sized.
			var zoomed = activeItem.isImage
				&& $fbContent.offsetWidth > $fbContentWrapper.clientWidth + 2;

			if ( zoomed ) {
				boxAnimate( [ 'fbContent',
						0,
						0,
						$fbContentWrapper.clientWidth,
						$fbContentWrapper.clientHeight
					],
					then,
					resizeTime
				);
			}
			return zoomed;
		}  // fitContent


		function getAnimationOrigin ( item, zoom, starting ) {
			// Returns position record of values we want to use for starting and ending.
			var
				request = starting || endAt == 'start' ? boxSettings.startAt : endAt,
				$requestedOrigin = $( request ),
				$thumb = item.thumbEl,  // might be undefined
				layout = getLayout( $requestedOrigin || $thumb ),
				width = 0,
				height = 0,
				left,
				top,
				padding,
				border;

			// reminder: setting style left/top includes padding, border and margin
			// setting style width/height does not include padding and border in standards mode

			if ( !startingViewport ) {
				startingViewport = getViewport();
			}

			if ( $requestedOrigin ) {
				left = layout.x - outerBorder;
				top = layout.y - outerBorder;
			}

			else if ( zoom && request !== NULL && layout.width ) {
				// might be <area> so use layout instead of offsetWidth

				// start/end from the thumb
				padding = layout.padding;
				border = layout.border;
				left = layout.left + padding.left + border.left - zoomBorder;
				top = layout.top + padding.top + border.top - zoomBorder;
				width = layout.width - padding.left - padding.right - border.left - border.right;
				height = layout.height - padding.top - padding.bottom - border.top - border.bottom;
			}

			else if ( request !== NULL && startTapX ) {
				// use the clicked coordinates, adjusted for any intervening page scroll
				left = startTapX + startingViewport.left - viewport.left - outerBorder;
				top = startTapY + startingViewport.top - viewport.top - outerBorder;
			}

			// default is screen center-ish if we haven't got anything yet
			// or if position is offscreen
			if ( +left !== left
				|| left > viewport.width  // left side is right of the viewport
				|| top > viewport.height  // top side is below the viewport
				|| left + width + outerBorderX2 < 0  // right side is left of the viewport
				|| top + height + outerBorderX2 < 0  // bottom side is above the viewport
			) {
				left = viewport.width / 2 - outerBorder;
				top = viewport.height / 3;
				width = height = 0;
			}

			return objectify(
				left + viewport.left,  // document coordinates
				top + viewport.top,
				width,
				height
			);
		}  // getAnimationOrigin


		function launchItem () {
			// Determine some activeItem state details and proceed to fetch, measure and show item.

			try {
				document.activeElement.blur();
			}
			catch ( _ ) { }

			// start timer for showing fbSlowLoad
			setTimer( function () {
					var $fbSlowLoad = thisBox.fbSlowLoad;

					$fbSlowLoad.src = waitGif;
					setStyle( $fbSlowLoad, [
						$fbMain.offsetLeft + ( $fbMain.offsetWidth - $fbSlowLoad.width ) / 2,
						$fbMain.offsetTop + ( $fbMain.offsetHeight - $fbSlowLoad.height ) / 2
					] );
					setStyle( $fbSlowLoad, 'zIndex', +$fbMain.style.zIndex + 77 );
					placeElement( $fbSlowLoad, $fbMain.parentElement );
				},
				1777, TIMER_slow, boxTimeouts
			);

			// get metrics requests from the options
			optionMetrics = objectify(
				// need the labels because boxLeft can be a % string
				'left', ifNotSet( activeSettings.boxLeft, boxSettings.boxLeft ),
				'top', ifNotSet( activeSettings.boxTop, boxSettings.boxTop ),
				'width', activeSettings.width,
				'height', activeSettings.height
			);
			if ( optionMetrics.left == 'click' ) {
				optionMetrics.left = startTapX;
			}
			if ( optionMetrics.top == 'click' ) {
				optionMetrics.top = startTapY;
			}

			// reset applied and sticky box metrics
			appliedMetrics = {};
			if ( !stickyMove ) {
				deltaMetrics.left = deltaMetrics.top = 0;
			}
			if ( !stickyResize ) {
				deltaMetrics.width = deltaMetrics.height = 0;
			}
			sizeRatio = UNDEFINED;

			// autoFit and overflow settings for this item
			autoFit = activeSettings.autoFit;
			overflow = activeItem.isHtml
				&& ( activeItem.isXSite || activeSettings.height || autoFit !== FALSE )
				&& ifNotSet( activeSettings.contentScroll, activeSettings.scrolling ) !== FALSE
				// scrolling is legacy
					? ( scrollbarSize ? 'auto' : 'scroll' )
					: 'hidden';
			autoFit = ifNotSet( autoFit,
				activeItem.isHtml && overflow == 'hidden' ? FALSE : TRUE
			);

			// animated transitions between gallery set images
			crossAnimate = crossFade = crossSlide = crossExpand = crossShift = FALSE;
			imageSwap = thisBox.state == STATE_transition
				&& previousItem.isImage
				&& activeItem.isImage;
			if ( imageSwap && transitionTime ) {
				if ( contentSwiped ) {
					crossShift = TRUE;
				}
				else {
					crossFade = imageTransition == OPT_crossfade;
					crossSlide = imageTransition == OPT_slide;
					crossExpand = imageTransition == OPT_expand;
					crossShift = imageTransition == OPT_shift;
				}
				crossAnimate = crossFade || crossSlide || crossExpand || crossShift;
			}

			requestedMetrics = extend( optionMetrics );
			nativeWidth = nativeHeight = UNDEFINED;
			calcAppliedMetrics( [ collapse, [ fetchContent, calcSize ] ] );
		}  // launchItem


		function calcAppliedMetrics ( then ) {
			// Determine box size metrics.
			// Will call getNativeSize if needed.
			var
				width = appliedMetrics.width,
				height = appliedMetrics.height,
				proportional = /%w/.test( requestedMetrics.height ),
				scaled;

			if ( !width || !height ) {
				width = resolvePercent(
					requestedMetrics.width,
					viewport.width,
					nativeWidth || mathMin( viewport.width * 0.87, 980 )
				);
				height = resolvePercent(
					requestedMetrics.height,
					proportional ? width : viewport.height,
					nativeHeight || viewport.height * 0.87
				);
				width += deltaMetrics.width;
				height += deltaMetrics.height;
			}

			// sizeRatio is boolean to start, updated to real ratio later
			sizeRatio = sizeRatio || proportional || !activeItem.isHtml;

			// max/minContentWidth/Height below are legacy
			maxWidth = resolvePercent(
				activeSettings.maxWidth || activeSettings.maxContentWidth,
				viewport.width,
				bigNumber
			);
			maxHeight = resolvePercent(
				activeSettings.maxHeight || activeSettings.maxContentHeight,
				viewport.height,
				bigNumber
			);

			minWidth = mathMin( maxWidth,  // min must be < max
				resolvePercent(
					activeSettings.minWidth || activeSettings.minContentWidth,
					viewport.width,
					isContip ? 35 : activeItem.isHtml ? 70 : 140
				)
			);
			minHeight = mathMin( maxHeight,
				resolvePercent(
					activeSettings.minHeight || activeSettings.minContentHeight,
					viewport.height,
					isContip ? 25 : activeItem.isHtml ? 50 : 100
				)
			);

			scaled = scale(  // scale up to enforce minWidth/Height
				width, height,
				minWidth, minHeight,
				sizeRatio, TRUE, 1
			);

			scaled = scale(  // scale down to enforce maxWidth/Height
				scaled.width, scaled.height,
				maxWidth, maxHeight,
				sizeRatio, FALSE, -1
			);

			appliedMetrics.width = scaled.width;
			appliedMetrics.height = scaled.height;

			if ( !nativeWidth ) {
				getNativeSize( [ calcAppliedMetrics, then ] );
			}
			else {
				trigger( then );
			}
		}  // calcAppliedMetrics


		function getNativeSize ( then, phase ) {
			// Unadjusted, unfit, unresized native width and height of content.
			var
				$fbCaliper = thisBox.fbCaliper,
				boxContent = activeItem.boxContent,
				img,
				evt,
				sum;

			if ( !thisBox.state ) {  // in case end happened while waiting for something to load
				phase = -1;  // don't do anything
			}

			if ( !phase ) {  // first pass or returning from a preload callback

				if ( activeItem.isImage ) {
					// get size from the preloader
					img = preloads[ boxContent ];  // probably already present
					if ( img && img.src ) {  // use src, not ok, in case of 404
						nativeWidth = img.width;
						nativeHeight = img.height;
						phase = 3;
					}
					else {
						// come back here after the img loads
						preload( boxContent, [ getNativeSize, then ] );
					}
				}

				// measureable html, and non-video iframes
				else if ( activeItem.isHtml && !activeItem.isXSite && !activeItem.isVideo ) {

					phase = 1;  // default is to proceed to phase 1 after this block

					if ( activeItem.isIframe ) {

						// iframes have to go straight into fbContent because firefox (which versions?)
						// will refetch src if the iframe is moved in the dom tree
						placeElement( $fbContent );
						thisBox.fbCaliper = $fbCaliper = $fbContent = newBoxPart(
							'fbContent',
							$fbContentWrapper,
							'iframe'
						);

						boxEvents.push(
							addEvent( $fbCaliper, 'load', iframeOnload )
						);
						evt = addEvent( $fbCaliper, 'load',
							function () {
								removeEvent( evt );
								getNativeSize( then, 1 );  // proceed to phase 1 when the iframe is loaded
							}
						);

						$fbCaliper.src = boxContent;
						phase = 0;  // do nothing until the load event restarts measuring
					}

					else {  // plain html
						$fbCaliper = newBoxPart( 'fbCaliper', topDoc.body );

						if ( activeItem.isAjax ) {
							ajax( boxContent, {
								finish: function ( result ) {
									// write response to the measurement div
									setContent( $fbCaliper,
										makeOuterHtml( 'div', result.responseText ),  // wrap in a div
										TRUE  // run scripts
									);
									// save the containing div for display by fetchContent
									activeItem.ajaxContent = $fbCaliper.firstChild;
									// proceed to phase 1 when the ajax fetch completes
									getNativeSize( then, 1 );
								}
							} );
							phase = 0;  // do nothing until the ajax callback restarts measuring
						}

						else {  // local content (no network fetch)
							setContent( $fbCaliper,
								activeItem.isInline
								? $( boxContent ).outerHTML  // includes div styles etc.
								: boxContent  // isDirect
							);
						}
					}

					setStyle( $fbCaliper, [
						'position', 'absolute',
						'visibility', 'hidden'
					] );
				}

				// x-site iframe, video, pdf
				else {
					$fbContent = placeElement( $fbContent );
					$fbContent = NULL;  // fetchContent will create new fbContent element
					phase = 3;
				}

			}  // end phase 0

			// wait for all imgs referenced in the html caliper to load
			// (iframes are ok because the callback fires from onload)
			if ( phase == 1 ) {  // measurable content continuation
				preload( select( 'img', $fbCaliper ), [ getNativeSize, then, 2 ] );
			}

			// measure and capture the caliper div's html content or iframe element
			if ( phase == 2 ) {  // measurable content continuation

				setStyle( $fbCaliper, [
					'width', appliedMetrics.width,
					'height', bigNumber
				] );

				getNativeHtmlSize( $fbCaliper );

				phase = 3;  // fall through

			}  // end phase 2

			if ( phase == 3 ) {

				// for content that can't be measured
				nativeWidth = nativeWidth || appliedMetrics.width;
				nativeHeight = nativeHeight || appliedMetrics.height;

				// reset initial default values now that native dims can be considered
				appliedMetrics = {};

				if ( sizeRatio ) {  // starts life as a boolean
					sizeRatio = nativeWidth / nativeHeight;  // updated with real numbers

					// force sticky size deltas to new item's proportions
					sum = deltaMetrics.width + deltaMetrics.height;
					deltaMetrics.height = sum / ( sizeRatio + 1 );
					deltaMetrics.width = sum - deltaMetrics.height;
				}

				if ( $fbContent == $fbCaliper ) {
					setStyle( $fbContent, [
						'position', '',
						'width', '',
						'height', ''
					] );
				}
				else {
					placeElement( $fbCaliper );
				}

				$fbCaliper = NULL;
				deleteProp( thisBox, 'fbCaliper' );
				trigger( then );
			}
		}  // getNativeSize


		function getNativeHtmlSize ( $el ) {
			// nativeWidth/Height for an element's first child
			var
				doc = getOwnerWindow( $el.contentWindow, 'document' ),  // iframe x-domain check
				$child,
				position,
				height,
				overflowX,
				overflowY,
				layout,
				layout2;

			if ( ( $child = doc ? doc.body : select( '*', $el, 0 ) ) ) {
				position = $child.style.position;
				height = $child.style.height;
				overflowX = $el.style.overflowX;
				overflowY = $el.style.overflowY;
				setStyle( $el, 'overflow', 'hidden' );  // remove parent scrollbars

				// div will grow to content height, including content margins
				// iframe body may shrink below available width
				// and won't grow to fill the caliper height
				setStyle( $child, [
					'position', 'absolute',
					'height', 'auto'
				] );
				layout = getLayout( $child );

				if ( doc ) {
					setStyle( $child, 'position', '' );
					layout2 = getLayout( $child );
					// don't use offsetWidth/Height because those are Math.floor of getBCR numbers
					if ( !layout.width || layout2.width && layout2.width < layout.width ) {
						layout = layout2;
					}
				}

				setStyle( $child, 'position', position );  // revert styles
				setStyle( $child, 'height', height );
				setStyle( $el, [
					'overflowX', overflowX,
					'overflowY', overflowY
				] );

				nativeWidth = mathCeil( layout.width + layout.margin.left + layout.margin.right );
				nativeHeight = mathCeil( layout.height + layout.margin.top + layout.margin.bottom );
			}
		}  // getNativeHtmlSize


		function collapse ( then, phase ) {
			// Preps floatbox bits for content and/or size changes.

			if ( !phase ) {  // phase 0

				// cancel pending timeouts and remove slowLoad
				clearTimer( TIMER_slow, boxTimeouts );  // cancel a pending slowLoad timer
				clearTimer( TIMER_end, boxTimeouts );  // a pending autoEnd timer
				clearTimer( TIMER_slideshow, boxTimeouts );  // slideshow auto-advance
				placeElement( thisBox.fbSlowLoad );  // remove the slow load gif if it's there

				// remove resizer, navOverlay and useMap
				postResize( TRUE );

				// close any index link popup thumbs that might be currently showing
				popupHideAll();

				// always animate with fbMain in position:absolute
				setFixed( FALSE );

				// clean up some fit adjustments
				setStyle( thisBox.fbOuterClose, 'margin', 0 );
				setStyle( [ thisBox.fbCaption, thisBox.fbCaption2 ], [
					'maxHeight', '',
					'overflow', ''
				] );

				if ( crossAnimate || thisBox.state == STATE_resize ) {
					// hide the panels
					setStyle( [ thisBox.fbTopPanel, thisBox.fbBottomPanel ],
						'visibility', 'hidden'
					);
					trigger( then );  // we're finished
				}

				else {

					// remove itemEvents
					while ( itemEvents.length ) {
						removeEvent( itemEvents.pop() );
					}

					// set boxLiner (or box for tooltips) opacity, maybe animated
					boxAnimate( [ isContip ? 'fbMain' : 'fbLiner',
							'opacity', 0
						],
						[ collapse, then, 1 ],
						thisBox.state == STATE_initial ? 0 : transitionTime && fadeTime
					);
				}
			}  // phase 0

			if ( phase == 1 ) {  // we've finished the animated fade-out

				if ( $fbContent
					&& activeItem.isIframe
					&& ( thisBox.state === STATE_end
						|| thisBox.state == STATE_transition
						|| thisBox.state == STATE_show
					)
				) {

					if ( activeItem.ytPlayer ) {
						activeItem.ytPlayer.destroy();
						deleteProp( activeItem, 'ytPlayer' );
					}

					$fbContent.src = aboutBlank;
				}

				trigger( then );
			}  // phase 1
		}  // collapse


		function fetchContent ( then, phase ) {
			// Setup new content and panels.
			var
				boxContent = activeItem.boxContent,
				altContent = activeSettings.altContent || '',
				max = itemCount - 1,
				contentEl,
				$wrapperNode,
				$fbNode,
				$childNode,
				$sourceNode,
				$child,
				$text,
				name,
				setting,
				loRange,
				hiRange,
				range,
				nextIdx,
				thisItem,
				$newThumb,
				thumbSrc,
				match,
				i;

			function configureLink ( $node, href, html ) {
				// update various panel component links

				if ( $node && href ) {
					attr( $node, 'href', href && encodeHTML( href ) || NULL );
					getByClass( 'fbText', $node, 0 ).innerHTML = html || '';
				}
				setStyle( $node, 'display', href ? '' : 'none' );
			}

			if ( !phase ) {  // phase 0
				phase = 1;  // default is to fall through unless the ajax section tells it not to

				// discard previous content unless we're going from img to img
				// getNativeSize populated same-domain iframe
				contentEl = activeItem.isImage ? 'img'
					: activeItem.isIframe ? 'iframe'
					: 'div';
				if ( !getTagName( $fbContent, contentEl ) ) {
					placeElement( $fbContent );
					$fbContent = NULL;
				}

				if ( !$fbContent ) {
					$fbContent = newBoxPart( 'fbContent', $fbContentWrapper, contentEl );
				}

				if ( activeItem.isImage ) {
					attr( $fbContent, 'alt', altContent );
					if ( !imageSwap ) {
						// let the animation sequence in calcSize assign src as required for imageSwap
						$fbContent.src = preloads[ boxContent ].src;
					}
				}

				else if ( activeItem.isIframe ) {
					attr( $fbContent, 'title', altContent );  // 508 compliance
				}

				else {  // non-iframe html or video content

					if ( activeItem.isDirect ) {
						setContent( $fbContent, boxContent, TRUE );  // place direct content
					}

					else if ( activeItem.isInline ) {  // move inline content into floatbox
						moveElement( activeItem.contentWrapper.firstChild, $fbContent );
					}

					else if ( activeItem.isAjax ) {

						placeElement( $fbContent.firstChild );  // clear sameBox or gallery content

						if ( activeItem.ajaxContent ) {
							// display the fragment that was fetched and saved by getNativeSize
							// will activate later as part of fbMain
							placeElement( activeItem.ajaxContent, $fbContent );
						}

						else {  // go get it
							phase = 0;
							ajax( boxContent, {
								$: placeElement( newElement( 'div' ), $fbContent ),
								finish: [ fetchContent, then, 1 ]
							} );
						}
					}

					// video content will be inserted at show time
					// so that it doesn't try to come in while the box is animating

					activeItem.ajaxContent = NULL;  // trigger a re-fetch next time this item is opened
				}
			}  // phase 0

			if ( phase == 1 ) {

				setStyle( $fbContent, [
					'display', '',  // collapse may have set display:none
					'borderWidth', 0  // override css conflicts
				] );

				// resolve various caption, header and footer types
				i = captionNames.length;
				while ( i-- ) {
					name = captionNames[ i ];
					$fbNode = thisBox[ camelCase( 'fb-' + name ) ];
					if ( ( setting = activeSettings[ name ] ) ) {

						if ( ( match = /^#([\w\-.:]+)$/.exec( setting ) ) ) {
							// a thing that originates from a hidden element

							$childNode = $fbNode.firstChild;
							$sourceNode = $childNode && $childNode.id == match[ 1 ]
								? $childNode  // thing is already in the current box
								: $( match[ 1 ] );  // thing is on the host page, maybe not wrapped yet

							if ( $fbNode && $sourceNode ) {

								if ( $sourceNode.parentElement.fbName == $fbNode.fbName
									&& $sourceNode.parentElement != $fbNode
								) {
									// hidden div header or footer is already busy on a different fb instance
									setting = '';
								}

								else {
									// ... its usable and either down on the page or in the current floatbox
									activeItem.wrapperDivs[ i ] =
										$sourceNode.parentElement == $fbNode && previousItem
										? previousItem.wrapperDivs[ i ]  // thing is already in this box
										: wrapElement( $sourceNode );  // on the page, not currently in use
								}
							}
						}

						else if ( name.indexOf( 'caption' ) == 0 && setting == 'href' ) {
							// expand 'href' to cleaned-up file name
							setting = patch( activeItem.boxName || '',
								/[_-]/g, ' ',
								/\b\w/g, function ( $0 ) { return $0.toUpperCase(); }
							);
						}

						else if ( /&lt;.+&gt;/.test( setting ) ) {
							setting = decodeHTML( setting );  // decode encoded html
						}

						else if ( !rexHtml.test( setting ) ) {
							setting = encodeHTML( setting );  // encode plain text but not plain html
						}

						activeItem.captions[ i ] = setting;
					}
				}

				// update panels

				// hide header and footer if they're changing
				setStyle( [
						activeSettings.header != previousSettings.header && thisBox.fbHeader,
						activeSettings.footer != previousSettings.footer && thisBox.fbFooter
					],
					'visibility', 'hidden'
				);

				// captions, header and footer
				i = captionNames.length;
				while ( i-- ) {
					name = captionNames[ i ];

					if ( ( $fbNode = thisBox[ camelCase( 'fb-' + name ) ] ) ) {

						if ( ( $wrapperNode = activeItem.wrapperDivs[ i ] ) ) {
							// it's coming from a div (but might already be retained in the header or footer)
							$child = $wrapperNode.firstChild;
							if ( $child && $wrapperNode != $fbNode ) {  // it's not yet placed in the box
								$fbNode.innerHTML = '';  // remove caption from previous gallery item
								moveElement( $child, $fbNode );
								attr( select( '*', $fbNode ),
									'tabindex', NULL  // remove outline from clicked links in captions
								);
							}
						}

						else {
							$fbNode.innerHTML = activeItem.captions[ i ] || '';
						}

						setStyle( $fbNode, 'display', $fbNode.innerHTML ? '' : 'none' );
					}
				}

				// item x of y
				if ( thisBox.fbItemNumber ) {
					thisBox.fbItemNumber.innerHTML = patch(
						strings[
							activeItem.isImage ? STR_image
							: activeItem.isHtml ? STR_page
							: STR_item
						],
						'%1', activeIndex + 1,
						'%2', itemCount
					);
				}

				// info link
				if ( ( $fbNode = thisBox.fbInfo ) ) {
					configureLink( $fbNode,
						activeSettings.info,
						activeSettings.infoText || strings[ STR_info ]
					);
					attr( $fbNode, 'data-fb-options',
						makeOptionString( parseOptions( activeSettings.infoOptions ) )
					);
				}

				// print button
				if ( ( $fbNode = thisBox.fbPrint ) ) {
					configureLink( $fbNode,
						activeSettings.showPrint && !activeItem.isXSite && boxContent,
						activeSettings.printText || strings[ STR_print ]
					);
				}

				// new window link
				if ( ( $fbNode = thisBox.fbNewWindow ) ) {
					configureLink( $fbNode,
						activeSettings.showNewWindow && activeItem.isUrl && boxContent,
						strings[ STR_open ]
					);
				}

				// index links
				if ( ( $fbNode = thisBox.fbIndex ) ) {
					$fbNode.innerHTML = '';

					// calc indices for items within range of current item
					if ( numIndexLinks == -1 ) {  // -1 means no restriction on link count
						loRange = 0;
						hiRange = max;
					}

					else {
						range = (numIndexLinks >>> 1) - 1;
						loRange = activeIndex - range;
						hiRange = activeIndex + range;

						if ( loRange <= 0 ) {
							hiRange += mathMin( 1 - loRange, range );
						}

						if ( !activeIndex ) {
							hiRange++;  // index is zero
						}

						if ( hiRange - max >= 0 ) {
							loRange -= mathMin( 1 + hiRange - max, range );
						}

						if ( activeIndex == max ) {
							loRange--;
						}
					}

					for ( i = 0; i < itemCount; i++ ) {  // iterate each item and build a series of links
						nextIdx = i && i < loRange ? loRange  // jump to first in-range item
							: i != max && i > hiRange ? max  // jump to last item
							: i;
						if ( nextIdx != i ) {  // add dots if skipped items
							i = nextIdx;
							$child = newElement( 'span', '...' );
							setStyle( $child, 'color', getStyle( $fbNode, 'color' ) );
							placeElement( $child, $fbNode );
						}

						thisItem = currentSet[ i ];
						if ( thisItem.isUrl ) {

							// build a clickable anchor for this item
							$child = newElement( 'a' );

							// add popup thumb (as first-child)
							setting = thisItem.itemSettings.indexThumbSource;
							thumbSrc =
								( setting == 'href' ? thisItem.isImage && thisItem.boxContent : setting )
								|| thisItem.thumbSrc;
							if ( thumbSrc && boxSettings.showIndexThumbs !== FALSE ) {
								addClass( $child, 'fbPop' + ( /t/.test( indexPos ) ? 'down' : 'up' ) );
								$newThumb = newElement( 'img' );
								if ( ( setting = boxSettings.maxIndexThumbSize ) ) {
									setStyle( $newThumb, [
										'maxWidth', setting,
										'maxHeight', setting
									] );
								}
								$newThumb.src = thumbSrc;
								placeElement( $newThumb, $child );
							}

							// add link text
							setStyle( $child, 'color', textColor );
							$text = newElement( 'span' );
							addClass( $text, 'fbText' );  // underline on mouseover
							placeElement( $text, $child );

							// add to doc and finalize this index link setup
							if ( i == activeIndex ) {
								addClass( $child, 'fbCurrentIndex' );
							}
							else {
								itemEvents.push(
									addEvent( $child, [ 'onmouseover', 'onmouseout' ], highlightHandler )
								);
							}
							placeElement( $child, $fbNode );
							configureLink( $child,
								thisItem.boxContent,
								'&nbsp;' + ( i + 1 ) + '&nbsp;'
							);

							// add click handler (co-operate with popupHandler)
							attr( $child, 'data-fb', i );
							itemEvents.push(
								addEvent( $child, 'click', function ( e ) {
									stopEvent( e );
									if ( tapDetails.eType ) {
										popupHide( this );
										showItem( attr( this, 'data-fb' ) );
									}
								} )
							);
						}
					}
					popupActivate( select( 'a', $fbNode ), thisBox );
				}

				// nav controls for sameBox restarts
				setStyle( thisBox.fbNav, 'display', itemCount > 1 ? '' : 'none' );

				if ( thisBox.state == STATE_initial ) {
					thisBox.state = STATE_start;
				}

				trigger( then );
			}  // phase 1
		}  // fetchContent


		function calcSize ( fit, time, autoFitCount, firstScaling, captionHeight ) {
			// Floatbox dimensions, including panels.
			if ( !thisBox.state || !$fbMain ) {
				// might have been closed during the content fetch
				return;
			}
			var
				$fbFloater = thisBox.fbFloater,
				boxContent = activeItem.boxContent,
				contentSrc = preloads[ boxContent ] && preloads[ boxContent ].src || boxContent,
				minBoxWidth = resolvePercent(
					ifNotSet( activeSettings.minBoxWidth, boxSettings.minBoxWidth ),
					viewport.width - autoFitSpace * 2, 0 ) + deltaMetrics.width,
				minBoxHeight = resolvePercent(
					ifNotSet( activeSettings.minBoxHeight, boxSettings.minBoxHeight ),
					viewport.height - autoFitSpace * 2, 0 ) + deltaMetrics.height,
				placement = isTooltip && ( boxSettings.placement || 'bottom' ),
				panelHeight = {},
				contentWrapperWidth = $fbContentWrapper.clientWidth,
				contentWrapperHeight = $fbContentWrapper.clientHeight,
				zoomStart = zoomer && thisBox.state == STATE_start,
				newCaptionHeight,
				freeSpace,
				ratio,
				factor,
				layout,
				scaled,
				dx,
				dy,
				moved,
				floaterPos,
				contentPos,
				backwards,
				pad;

			function getTooltipPos ( placement, dx, dy ) {
				// Left and Top screen coordinates for a tooltip
				var
					$fbSpacer = thisBox.fbSpacer,
					$fbArrow = $fbSpacer && $fbSpacer.firstChild,
					arrowSize = ifNotSet( boxSettings.arrowSize, 16 ),
					hostLayout = simpleLayout( activeItem.hostEl ),
					left = hostLayout.x - boxWidth / 2,
					top = hostLayout.y - boxHeight / 2;

				if ( placement != 'center' ) {  // center gets no arrow or position adjustments

					if ( !$fbSpacer ) {
						$fbSpacer = newBoxPart( 'fbSpacer', $fbMain, 'div' );
						$fbArrow = newElement( 'i' );
						addClass( $fbArrow, 'fbIcon' );
						setStyle( [ $fbSpacer, $fbArrow ], [
							'color', boxSettings.arrowColor || outerBorderColor,
							'fontSize', arrowSize
						] );
						placeElement( $fbArrow, $fbSpacer );
					}

					$fbArrow.innerHTML = icons[ 'tooltip' + placement ];

					setStyle( [ $fbSpacer, $fbArrow ], [
						'left', '',
						'right', '',
						'top', '',
						'bottom', '',
						'margin', ''
					] );

					if ( placement == 'left' || placement == 'right' ) {

						left +=
							( ( hostLayout.width + boxWidth ) / 2 + arrowSize - 1 )
							* ( placement == 'left' ? -1 : 1 );
						top += dy;

						setStyle( $fbSpacer, [
							placement, boxWidth - outerBorder - 1,
							'top', mathMax( hostLayout.top - top - outerBorder, -outerBorder ),
							'height', mathMin( boxHeight, hostLayout.height ),
							'width', arrowSize + 1
						] );
					}

					else {  // placement == top or default bottom

						left += dx + boxWidth / 5;  // looks better off-center
						top +=
							( ( hostLayout.height + boxHeight ) / 2 + arrowSize - 1 )
							* ( placement == 'top' ? -1 : 1 );

						setStyle( $fbSpacer, [
							placement, boxHeight - outerBorder - 1,
							'left', mathMax( hostLayout.left - left - outerBorder, -outerBorder ),
							'width', mathMin( boxWidth, hostLayout.width ),
							'height', arrowSize + 1
						] );
					}
				}

				return objectify( left, top );
			}  // getTooltipPos

			// insert scrollbars if needed (before setting panel size)
			dx = dy = 0;  // width/height adjustments for scrollbars
			if ( overflow != 'hidden' ) {

				if ( nativeWidth > appliedMetrics.width + 3 ) {
					dy = scrollbarSize;
					if ( isIos ) {
						setStyle( $fbContent, 'width', nativeWidth );
					}
				}

				if ( nativeHeight > appliedMetrics.height + 3 ) {
					dx = scrollbarSize;
					if ( isIos ) {
						setStyle( $fbContent, 'height', nativeHeight );
					}
				}
			}

			// set panel cell widths, vertically pad out the panels, and capture their height
			// includes header and footer
			boxWidth = appliedMetrics.width
				+ dx + innerBorderX2 + outerBorderX2 + padding * 2;
			minBoxWidth = mathMax( 0, minBoxWidth - boxWidth );  // delta for fbContentWrapper
			maxBoxWidth = viewport.width - autoFitSpace * 2;  // available width
			panelHeight = setPanelSize( boxWidth + minBoxWidth );

			// header/footerSpace are the gaps to be left between the outerBorder and viewport edge
			headerSpace = mathMax( panelHeight.header, autoFitSpace );
			footerSpace = mathMax( panelHeight.footer, autoFitSpace );

			// contentWidth/Height is inside innerBorder
			// boxWidth/Height is outside outerBorder
			boxHeight = appliedMetrics.height
				+ dy + innerBorderX2 + outerBorderX2 + panelHeight.top + panelHeight.bottom;
			maxBoxHeight = viewport.height - headerSpace - footerSpace;

			// autoFit
			fit = ifNotSet( fit,
				sizeState == SIZE_large && !inFrameResize ? FALSE : autoFit
			);
			autoFitCount = ifNotSet( autoFitCount,
				fit ? 3 : -1
			);

			// scale content down if box is bigger than available screen
			if ( fit && autoFitCount > 0 ) {

				dx = boxWidth - maxBoxWidth;
				dy = boxHeight - maxBoxHeight;
				if ( dx > 0 || dy > 0 ) {

					// don't let the captions keep growing
					newCaptionHeight = mathMax(
						hasCaption ? thisBox.fbCaption.offsetHeight : 0,
						hasCaption2 ? thisBox.fbCaption2.offsetHeight : 0
					);
					if ( autoFitCount == 2 ) {
						firstScaling = extend( appliedMetrics );
					}

					if ( autoFitCount < 2 && newCaptionHeight > captionHeight ) {
						fit = FALSE;
						extend( appliedMetrics, firstScaling );
					}

					if ( fit && ( dx > 0 || dy > 0 ) ) {

						scaled = scale(
							appliedMetrics.width, appliedMetrics.height,
							appliedMetrics.width - dx, appliedMetrics.height - dy,
							sizeRatio, FALSE, -1
						);
						scaled = scale(  // scale up to enforce minWidth/Height
							scaled.width, scaled.height,
							minWidth, minHeight,
							sizeRatio, TRUE, 1
						);
						extend( appliedMetrics, scaled );
					}

					return calcSize( fit, time, autoFitCount - 1, firstScaling, newCaptionHeight );
				}
			}

			// apply minBoxWidth/Height (minBoxWidth calced above)
			minBoxHeight = mathMax( 0, minBoxHeight - boxHeight );  // delta for fbContentWrapper

			boxWidth += minBoxWidth;
			boxHeight += minBoxHeight;

			// now we've got appliedMetrics.width/height, boxWidth/Height and panelHeights

			// calc left and top

			if ( isTooltip ) {
				extend( appliedMetrics, getTooltipPos( placement, 0, 0 ) );
			}

			else {  // std box position

				appliedMetrics.left = ifNotSet( appliedMetrics.left,
					resolvePercent(
						requestedMetrics.left,
						viewport.width,
						( viewport.width - boxWidth ) / 2
					) + deltaMetrics.left
				);

				freeSpace = viewport.height - boxHeight - headerSpace - footerSpace;
				ratio = freeSpace / viewport.height;  // move box up on taller screens
				factor = ratio <= 0.15 ? 2
					: ratio < 0.3 ? 1 + ratio / 0.15
					: 3;  // default top is 1/3 of free space
				appliedMetrics.top = ifNotSet( appliedMetrics.top,
					resolvePercent(
						requestedMetrics.top,
						viewport.height,
						freeSpace / factor + headerSpace
					) + deltaMetrics.top
				);

				// html child box position - half way to the parent, if parent is higher and lefter
				if ( parentBox && activeItem.isHtml ) {
					layout = simpleLayout( parentBox.fbMain );

					if ( requestedMetrics.left === UNDEFINED && layout.left > 0 ) {  // is on screen
						dx = appliedMetrics.left - layout.left;  // distance of child box from parent
						appliedMetrics.left -= dx > 0 ? dx / 2 : 0;
					}

					if ( requestedMetrics.top === UNDEFINED && layout.top > 0 ) {
						dy = appliedMetrics.top - layout.top;
						appliedMetrics.top -= dy > 0 ? dy / 2 : 0;
					}
				}
			}

			if ( thisBox.state != STATE_resize ) {

				dx = dy = moved = 0;  // box move deltas

				// move left if the right side is off-screen
				pad = viewport.width - autoFitSpace - boxWidth - appliedMetrics.left;
				if ( pad < 0 ) {
					dx = moved = pad;
					if ( placement == 'right' ) {
						placement = 'left';
						dx = 0;
					}
				}

				// but move right if left side is off-screen takes precedence
				pad = autoFitSpace - appliedMetrics.left;
				if ( pad > 0 ) {
					dx = moved = pad;
					if ( placement == 'left' ) {
						placement = 'right';
						dx = 0;
					}
				}

				// move up if the bottom side is off-screen
				pad = viewport.height - footerSpace - boxHeight - appliedMetrics.top;
				if ( pad < 0 ) {
					dy = moved = pad;
					if ( placement == 'bottom' ) {
						placement = 'top';
						dy = 0;
					}
				}

				// but move down if top side is off-screen takes precedence
				pad = headerSpace - appliedMetrics.top;
				if ( pad > 0 ) {
					dy = moved = pad;
					if ( placement == 'top' ) {
						placement = 'bottom';
						dy = 0;
					}
				}

				if ( moved ) {

					if ( isTooltip ) {
						extend( appliedMetrics, getTooltipPos( placement, dx, dy ) );
					}

					else {

						if ( requestedMetrics.left === UNDEFINED
							|| requestedMetrics.left == startTapX  // startTap for boxLeft:click requests
						) {
							appliedMetrics.left += dx;
						}

						if ( requestedMetrics.top === UNDEFINED
							|| requestedMetrics.top == startTapY
						) {
							appliedMetrics.top += dy;
						}
					}
				}
			}

			// move fixed-positioned boxes from the virtual screen to the viewport
			// and non-fixed to document coordinates
			layout = isFixedPos ? visualOffset : viewport;
			dx = layout.left + resolvePercent( boxSettings.boxLeftAdjust, viewport.width, 0 );
			dy = layout.top + resolvePercent( boxSettings.boxTopAdjust, viewport.height, 0 );

			// setup for transition

			if ( crossAnimate ) {

				// going backwards? (the 3 handles two-member sets)
				backwards = activeIndex == ( previousIndex || mathMax( itemCount, 3 ) ) - 1;
				$fbFloater.src = $fbContent.src;  // fbFloater shows current item

				// set floater's initial position and opacity (replicate fbContent)
				setStyle( $fbFloater, [
						getStyle( $fbContent, 'left', TRUE ),
						getStyle( $fbContent, 'top', TRUE ),
						$fbContent.offsetWidth,
						$fbContent.offsetHeight
					], [
						'opacity', 1,
						'borderWidth', 0  // zoomBorder may be left over from a zoom start
					]
				);
				placeElement( $fbFloater, $fbContentWrapper );  // on top of fbContent

				// calc floater's final position and size based on the calced dimension of the new box
				scaled = scale(
					$fbContent.offsetWidth,
					$fbContent.offsetHeight,
					crossFade ? appliedMetrics.width : $fbContent.offsetWidth,
					appliedMetrics.height,
					$fbContent.offsetWidth / $fbContent.offsetHeight,
					TRUE
				);

				floaterPos = objectify( 'fbFloater',
					crossFade ? ( appliedMetrics.width - scaled.width ) / 2
						: backwards ? appliedMetrics.width - 1
						: crossExpand ? 0
						: 1 - scaled.width,  // slide or shift
					( appliedMetrics.height - scaled.height ) / 2,
					crossExpand ? 0 : scaled.width,
					scaled.height
				);

				if ( crossFade ) {
					floaterPos.opacity = 0;
				}

				// set new fbContent's starting position
				pad = crossShift && contentWrapperHeight < appliedMetrics.height;
				scaled = scale(
					appliedMetrics.width,  // new image
					appliedMetrics.height,
					pad ? appliedMetrics.width : contentWrapperWidth,
					pad ? appliedMetrics.height : contentWrapperHeight,
					sizeRatio,
					TRUE, 1
				);

				setStyle( $fbContent, [
					crossFade ? ( contentWrapperWidth - scaled.width ) / 2
						: crossSlide ? 0
						: backwards ? ( crossExpand ? 0 : 1 - scaled.width )
						: contentWrapperWidth - 1,  // expand or shift, not backwards
					( contentWrapperHeight - scaled.height ) / 2,
					crossExpand ? 0 : scaled.width,
					scaled.height
				] );

				// new fbContent's final animation size
				contentPos = [ 'fbContent', 0, 0, appliedMetrics.width, appliedMetrics.height ];

				$fbContent.src = contentSrc;
			}

			if ( !zoomStart ) {
				setStyle( $fbMain, 'visibility', '' );  // otherwise let zoomIn reveal the box

				if ( splitResize && !getStyle( $fbMain, 'width', TRUE ) ) {
					// animate up to small box size before doing split animation
					boxAnimate( [ 'fbMain',
							appliedMetrics.left + dx + ( boxWidth - smallBoxSize ) / 2 - outerBorder,
							appliedMetrics.top + dy + ( boxHeight - smallBoxSize ) / 2 - outerBorder,
							smallBoxSize,
							smallBoxSize
						],
						0, resizeTime
					);
				}
			}

			time = +time === time ? time
				: thisBox.state == STATE_transition ? transitionTime
				: zoomStart ? 0
				: resizeTime;

			if ( splitResize ) {
				splitResize = !crossAnimate && (
					appliedMetrics.width - contentWrapperWidth
					> appliedMetrics.height - contentWrapperHeight
					? 'x' : 'y'  // shrink before grow
				);
			}

			setStyle( [ $fbContentWrapper, $fbContent ], 'overflow', 'hidden' );
			// postResize will restore the scrollbars

			boxAnimate( [
					[ 'fbMain',
						appliedMetrics.left + dx,
						appliedMetrics.top + dy,
						boxWidth - outerBorderX2,
						boxHeight - outerBorderX2
					],
					[ 'fbContentWrapper',
						'left', padding + minBoxWidth / 2,
						'top', panelHeight.top + minBoxHeight / 2,
						'right', padding + minBoxWidth / 2,
						'bottom', panelHeight.bottom + minBoxHeight / 2
					],
					floaterPos,  // floaterPos & contentPos set only if crossAnimating
					contentPos
				],
				function () {
					if ( $fbMain && thisBox.state ) {

						// timeless image swaps were deferred
						if ( activeItem.isImage && $fbContent.src != contentSrc ) {
							$fbContent.src = contentSrc;
						}

						if ( crossAnimate ) {
							// remove explicit positioning from content
							setStyle( $fbContent, [
								'left', '',
								'top', '',
								'width', '',
								'height', ''
							] );
							// reset floater
							placeElement( $fbFloater );
							$fbFloater.src = blankGif;
							setStyle( $fbFloater, 'opacity', 1 );
						}

						// carry on
						if ( zoomStart ) {
							zoomIn();
						}
						else {
							showContent();
						}
					}
				},
				time, splitResize
			);
		}  // calcSize


		function setPanelSize ( panelWidth ) {
			// Configures and measures topPanel, bottomPanel, header and footer
			// based on boxWidth provided by the initial 'panelWidth' arg.
			var
				rtn = {},
				cellWidths = [],
				$indexImgs = thisBox.fbIndex && select( 'img', thisBox.fbIndex ),
				$panels,
				$panel,
				$cells,
				widthOrder,
				over,
				delta,
				width, height,
				xpad, ypad,
				i, j;

			// header and footer
			$panels = [ thisBox.fbHeader, thisBox.fbFooter ];
			panelWidth -= outerBorderX2;  // header and footer extend to the inside of outer border
			setStyle( $panels, [
				'width', panelWidth,
				'display', ''  // empty panels were hidden
			] );

			i = 2;
			while ( i-- ) {
				$panel = $panels[ i ];
				height = $panel ? $panel.offsetHeight + 2 : 0;
				rtn[ i ? 'footer' : 'header' ] = height;
				setStyle( $panel, [
					'width', 'auto',
					'left', 0,  // extend to the inner edge of outerBorder
					'right', 0,
					i ? 'top' : 'bottom', '100%',
					'margin' + ( i ? 'Top' : 'Bottom' ), outerBorder
				] );
			}

			// upper and lower panels
			$panels = [ thisBox.fbTopPanel, thisBox.fbBottomPanel ];
			xpad = padding || panelPadding;
			xpad = mathMax( xpad, boxRadius / 2 - xpad );  // move in from large box roundies
			panelWidth -= xpad * 2;
			setStyle( $panels, [
				'width', panelWidth,  // temporary, for measuring
				'display', ''  // content-less panels were previously turned off
			] );

			// hide indexLink thumbs from measuring
			setStyle( $indexImgs, 'display', 'none' );

			i = 2;
			while ( i-- ) {
				$panel = $panels[ i ];
				// add 1 to over to help with rounding problems on zoomed pages
				over = 1 - panelWidth;  // -ve overage if it's not too wide
				$cells = getByClass( 'fbCell', $panel );  // there will be three of them

				// let cells find their own width
				setStyle( $cells, [
					'width', 'auto',
					'marginRight', ''
				] );

				// if center cell has something, make left and right cells match widths
				if ( activeSettings.strictCentering !== FALSE && $cells[ 1 ].offsetWidth ) {
					setStyle( [ $cells[ 0 ], $cells[ 2 ] ],
						'minWidth',
						mathMax( $cells[ 0 ].offsetWidth, $cells[ 2 ].offsetWidth )
					);
				}

				// capture cell content width
				j = 3;  // $cells.length
				while ( j-- ) {
					width = $cells[ j ].offsetWidth;
					width += width ? 4 : 0;  // extra width avoids some undesired text wrap
					cellWidths[ j ] = width;
					over += width;
				}

				// set 20px margins between populated cells
				if ( cellWidths[ 0 ] && cellWidths[ 1 ] + cellWidths[ 2 ] ) {
					setStyle( $cells[ 0 ], 'marginRight', 20 );
					over += 20;
				}
				if ( cellWidths[ 1 ] && cellWidths[ 2 ] ) {
					setStyle( $cells[ 1 ], 'marginRight', 20 );
					over += 20;
				}

				// shrink oversized cells
				widthOrder = [ 0, 1, 2 ].sort( function ( a, b ) {
					return cellWidths[ a ] - cellWidths[ b ];  // from smallest to largest
				} );

				if ( over > 0 ) {

					// shrink largest to no less than second largest width
					delta = mathMin( over,
						cellWidths[ widthOrder[ 2 ] ] - cellWidths[ widthOrder[ 1 ] ]
					);
					cellWidths[ widthOrder[ 2 ] ] -= delta;
					over -= delta;

					if ( over > 0 ) {  // not enough?

						// shrink the two largest evenly to no less than the smallest
						delta = mathMin( over / 2,
							cellWidths[ widthOrder[ 1 ] ] - cellWidths[ widthOrder[ 0 ] ]
						);
						cellWidths[ widthOrder[ 2 ] ] -= mathCeil( delta );
						cellWidths[ widthOrder[ 1 ] ] -= mathFloor( delta );
						over -= 2 * delta;
					}

					if ( over > 0 ) {  // still not enough?

						// distribute remainder evenly to all three
						delta = mathCeil( over / 3 );
						cellWidths[ 0 ] -= delta;
						cellWidths[ 1 ] -= delta;
						cellWidths[ 2 ] -= over - delta * 2;  // for rounding
					}
				}

				// expand undersized cells so they don't bunch up on the left
				if ( over < 0 ) {  // expand left and right evenly
					delta = mathCeil( over / 2 );
					cellWidths[ 0 ] -= delta;
					cellWidths[ 2 ] -= over - delta;
				}

				// set cell widths
				j = 3;
				width = 0;  // capture the presence of panel content here
				while ( j-- ) {
					width += $cells[ j ].offsetWidth;
					setStyle( $cells[ j ], [
						'width', cellWidths[ j ],
						'minWidth', ''
					] );
				}
				if ( !width ) {
					setStyle( $panel, 'display', 'none' );
				}

				// vertical panel placement and padding
				height = $panel.offsetHeight;
				ypad = mathMax( height && panelPadding, mathMax( padding - height, 0 ) / 2 );
				setStyle( $panel, [
					'width', 'auto',
					'left', xpad,  // panels extend to the outer edge of innerBorder
					'right', xpad,
					i ? 'bottom' : 'top', ypad
				] );

				// report panel height (full height between inner and outer borders)
				rtn[ i ? 'bottom' : 'top' ] = height + ypad * 2;
			}

			// restore indexLink thumbs
			setStyle( $indexImgs, 'display', '' );

			return rtn;
		}  // setPanelSize


		function setFixed ( fixed ) {
			// Toggle fbMain css position and adjust so screen position remains unaltered.

			if ( fixed != isFixedPos ) {
				var
					position = fixed ? 'fixed' : 'absolute',
					layout = simpleLayout( $fbMain ),
					adjustment = fixed ? visualOffset : viewport;

				setStyle( $fbMain, [
					'position', position,
					'left', layout.left + adjustment.left,
					'top', layout.top + adjustment.top
				] );

				isFixedPos = fixed;
			}
		}  // setFixed


		function boxAnimate ( groups, then, time, split, easing ) {
			// Interface to fb.animate that uses names instead of $nodes.
			// Will queue requests until current animation (if any) completes.
			// 'groups' param can be singleton array or object, or array of arrays.
			var
				aniGroups = [],
				group,
				i;

			if ( !groups ) {
				// call without parameters is a callback from animate,
				// process the real callback and any queued requests
				setTimer( afterAnimation );
				setTimer( animationQueue.shift() );
				afterAnimation = NULL;
			}

			else if ( animationStatus.active ) {
				// animation is in progress, queue this new one
				animationQueue.push( [ boxAnimate, groups, then, time, split, easing ] );
			}

			else {

				// arrayify incoming singleton arrays and objects
				if ( !typeOf( groups[ 0 ], [ 'array', 'object' ] ) ) {
					groups = [ groups ];
				}

				for ( i = 0; i < groups.length; i++ ) {
					if ( ( group = groups[ i ] ) ) {
						group = objectify( group );
						if ( ( group.$ = thisBox[ group.$ ] ) ) {  // change fbName to corresponding node

							if ( split && getTagName( group.$, 'div' ) ) {
								if ( split == 'x' ) {
									deleteProp( group, 'left' );
									deleteProp( group, 'width' );
								}
								else {  // split == 'y'
									deleteProp( group, 'top' );
									deleteProp( group, 'height' );
								}
							}

							aniGroups.push( group );
						}
					}
				}

				// queue split animations and finish callbacks
				if ( split ) {
					animationQueue.push( [ boxAnimate, groups, then, time, 0, easing ] );
				}
				else {
					afterAnimation = then;
				}

				animate(
					aniGroups,
					boxAnimate,
					time,
					split ? 1 : UNDEFINED,
					easing,
					time && animationStatus
				);
			}
		}  // boxAnimate


		function zoomIn ( phase ) {
			// Animated start from a thumbnail.
			var
				contentLayout = simpleLayout( $fbContent ),
				$fbFloater = thisBox.fbFloater;

			if ( thisBox.state ) {

				if ( !phase ) {  // phase 0

					// turn off popup thumb if there is one
					popupLocked = FALSE;
					popupHide( activeItem.hostEl );

					// animate fbFloater up to the size and position where the content div will be
					// (box is already in final position, but invisible)
					// fbFloater was setup in configureBox to be on top of the fading-in overlay

					$fbFloater.src = zoomer;  // the full-sized image to zoom with
					boxAnimate( [ 'fbFloater',
							contentLayout.left - zoomBorder + viewport.left,
							contentLayout.top - zoomBorder + viewport.top,
							contentLayout.width,
							contentLayout.height
						],
						[ zoomIn, 1 ],
						resizeTime
					);
				}  // end phase 0

				if ( phase == 1 ) {  // animate box from exactly behind fbFloater to its final size

					// set starting position
					setStyle( $fbMain, [
							contentLayout.left + viewport.left,
							contentLayout.top + viewport.top,
							contentLayout.width - outerBorderX2,
							contentLayout.height - outerBorderX2
						]
					);
					setStyle( $fbMain, 'visibility', '' );

					// grow the box out from its hiding place behind fbFloater
					boxAnimate( [ 'fbMain',
							appliedMetrics.left + viewport.left,
							appliedMetrics.top + viewport.top,
							boxWidth - outerBorderX2,
							boxHeight - outerBorderX2
						],
						[ zoomIn, 2 ],
						resizeTime,
						0, 1  // no easing
					);
				}  // end phase 1

				if ( phase == 2 ) {

					// turn on the content
					setStyle( $fbLiner, 'opacity', 1 );  // was zeroed in collapse

					// delay turning off the zoomer image to give non-img content time to establish
					if ( activeItem.isImage ) {
						phase = 4;
					}
					else {
						setTimer( [ zoomIn, 3 ], 350 );
					}

					// carry on
					showContent();

				}  // end phase 2

				if ( phase == 3 ) {

					// fade out the zoomer image
					animate( [
							[ $fbFloater, 'opacity', 0 ]
						],
						[ zoomIn, 4 ]
					);

				}  // end phase 3

				if ( phase == 4 ) {

					// discard the floating zoomer image
					placeElement( $fbFloater );
					$fbFloater.src = blankGif;  // so the old image doesn't wink at us on the next zoom

				}  // end phase 4
			}
		}  // zoomIn


		function showContent ( phase ) {
			// Finalizes box configuration and shows content.
			var
				$docEl = topDoc.documentElement,
				focusser;

			function getYTPlayer () {
				activeItem.ytPlayer = new topWin.YT.Player( $fbContent );
				// will post event messages for auto-end handling
			}

			if ( thisBox.state ) {

				if ( !phase ) {  // phase 0

					// avoid unwanted future cross-animations
					imageSwap = crossAnimate = FALSE;

					// pageScroll (remove browser scrollbars)
					// first item of only box can remove scrollbars from the top page
					if ( !boxIndex
						&& thisBox.state == STATE_start
						&& boxSettings.pageScroll === FALSE
						&& $fbMain.offsetWidth <= viewport.width
						&& $fbMain.offsetHeight <= viewport.height  // box fits fully on screen
					) {
						setStyle( $docEl, [
							'marginRight', topWin.innerWidth - $docEl.clientWidth
								+ getStyle( $docEl, 'marginRight', TRUE ),
							'overflow', 'hidden'
						] );
						pageScrollDisabled = TRUE;
					}

					if ( activeItem.isIframe ) {

						// youtube api for auto-end handling
						if ( activeItem.vidService == 'youtube' ) {
							if ( topWin.YT ) {  // api is already loaded
								getYTPlayer();
							}
							else {
								topWin.onYouTubeIframeAPIReady = getYTPlayer;
								topFb.require( 'https://www.youtube.com/iframe_api' );
							}
						}

						if ( $fbContent.src != activeItem.boxContent ) {  // not set by getNativeSize
							$fbContent.src = activeItem.boxContent;
						}
					}

					// determine neighbour items
					if ( itemCount > 1 ) {
						prevIndex = activeIndex ? activeIndex - 1 : enableWrap && itemCount - 1;
						nextIndex = activeIndex < itemCount - 1 ? activeIndex + 1 : enableWrap && 0;
						// prev/nextHref must be null, not "", for attr() to remove it if necessary
						prevHref = currentSet[ prevIndex ] && currentSet[ prevIndex ].boxContent || NULL;
						nextHref = currentSet[ nextIndex ] && currentSet[ nextIndex ].boxContent || NULL;
					}

					// toggle nav gadgets based on wrap status & update nav hrefs
					if ( navButton ) {
						attr( thisBox.fbPrev, 'href', prevHref );
						setStyle( thisBox.fbPrev, 'opacity', prevHref ? '' : 0.5 );
						attr( thisBox.fbNext, 'href', nextHref );
						setStyle( thisBox.fbNext, 'opacity', nextHref ? '' : 0.5 );
					}

					if ( navOverlay ) {
						attr( [ thisBox.fbPrevPanel, thisBox.fbPrev2 ], 'href', prevHref );
						attr( [ thisBox.fbNextPanel, thisBox.fbNext2 ], 'href', nextHref );
					}

					// avoid confusing play/pause controls when showing a video
					setStyle( thisBox.fbPlayPause, 'visibility',
						activeItem.isVideo ? 'hidden' : ''
					);

					// light up the content

					setStyle( $fbContentWrapper, 'backgroundColor',
						activeSettings.contentBackgroundColor
						|| ( activeItem.isHtml ? 'white' : '' )
					);

					// do stuff for initial content (first content item)
					if ( thisBox.state == STATE_start ) {

						setBoxShadow();

						setStyle( [ thisBox.fbControls, thisBox.fbOuterClose ],
							'visibility', ''
						);
						if ( boxSettings.showMagCursor == 'once' ) {
							setStyle( activeItem.hostEl, 'cursor', '' );  // turn off show once mag cursor
						}
					}

					// for all content (first and subsequent gallery items)

					setStyle( [
							$fbLiner,  // fbLiner started life hidden in configureBox
							$fbContent,  // fbContent iframes were hidden in getNativeSize
							thisBox.fbTopPanel,
							thisBox.fbBottomPanel,  // collapse may have hidden the panels
							activeSettings.header && thisBox.fbHeader,
							activeSettings.footer && thisBox.fbFooter
						],
						'visibility', ''
					);

					postResize();  // resizer, navOverlay and useMap
					trigger( activeItem.scrollToHash );

					// fade in boxLiner (or box for tooltips) opacity
					setTimer( [ boxAnimate,
						[ isContip ? 'fbMain' : 'fbLiner', 'opacity', 1 ],
						[ showContent, 1 ],
						transitionTime && fadeTime
					] );
				}  // phase 0

				if ( phase == 1 && thisBox && currentSet ) {
					// preload next image and run some callbacks

					preload( +nextIndex === nextIndex && currentSet[ nextIndex ].isImage && nextHref );

					if ( boxSettings.autoEnd ) {
						setTimer( end, boxSettings.autoEnd * 999, TIMER_end, boxTimeouts );
					}

					if ( thisBox.state == STATE_start ) {

						focusser = getOwnerWindow( $fbContent.contentWindow ) || $fbMain;
						focusser = select( [ 'input[type="text"]', 'textarea' ], focusser, 0 )
							|| focusser;
						focusser.focus();
						setTimer( [ boxSettings.afterBoxStart, thisBox ] );
					}

					if ( thisBox.state == STATE_resize ) {
						setTimer( afterResize );
					}
					else if ( thisBox.state < STATE_show ) {
						setTimer( [ activeSettings.afterItemStart, thisBox ] );
					}

					// afterResize only once
					// scrollToHash has some closures into the iframe document
					afterResize = activeItem.scrollToHash = NULL;

					activate( $fbMain );  // activate after afterItemStart
					thisBox.state = STATE_show;

				}  // phase 1
			}
		}  // showContent


		function iframeOnload () {
			// Onload action for same-domain iframe content.
			// Inserts keyboard handler, restacks when clicked, scrolls to #hash request.
			var
				win = $fbContent && getOwnerWindow( $fbContent.contentWindow ),
				// require same domain because content may have navigated to cross-domain
				doc = win && win.document;

			function scrollToHash () {
				var $el = $( activeItem.scrollHash, doc );

				if ( $el ) {
					if ( isIos ) {
						$fbContentWrapper.scrollTop = $el.offsetTop;
					}
					else {
						win.scroll( 0, $el.offsetTop );
					}
				}
			}

			if ( doc && win.location.href.indexOf( aboutBlank ) < 0 ) {

				// don't save these events in itemEvents because IE, all versions,
				// will barf trying to remove them if the iframe has navigated
				if ( enableKeyboardNav ) {
					// add keydown handler so esc key closes the box
					addEvent( doc.documentElement, 'keydown', keydownHandler );
				}
				if ( !isModal && !isContip ) {
					// restack this box on click
					addEvent( doc.documentElement, [ 'mousedown', 'touchstart' ], restack );
				}
				if ( isIos ) {
					addEvent( doc.documentElement, 'touchstart', getMousedownHandler() );
					// because overflowed content can't be scrolled on zoomed screens on iPads
					// (unknown if this still applies in 2018)
				}

				if ( !$fbContent.ready ) {
					// scroll to hash
					if ( activeItem.scrollHash ) {
						scrollToHash();
						// redo after box is up in case a size change moved the scroll target
						activeItem.scrollToHash = scrollToHash;
					}
					$fbContent.ready = TRUE;
				}

				else {  // new content from navigation, adjust box size
					resize();
				}
			}
		}  // iframeOnload


		function postResize ( collapsing ) {
			// Configures: resizer state, nav overlay, useMap assignment,
			//    contentWrapper scrollbars, boxScroll, slideshow timer.
			// Call this whenever the box finishes resizing for whatever reason.
			var
				layout = simpleLayout( $fbContent ),
				contentWidth = layout.width,
				contentHeight = layout.height,
				contentWrapperWidth = $fbContentWrapper.clientWidth,
				contentWrapperHeight = $fbContentWrapper.clientHeight,
				isImage = activeItem.isImage,
				$map = $( activeSettings.useMap ),
				$contentImg = preloads[ activeItem.boxContent ],
				$fbResizer = thisBox.fbResizer,
				cursor,
				areas,
				$area,
				dataCoords,
				coords,
				i, j;

			// start with scrollbars restored and resizer and navOverlay removed
			setStyle( $fbContentWrapper,
				'overflow', isIos || !activeItem.isIframe ? overflow : 'hidden'
			);
			setStyle( $fbContent, [
				'overflow', isIos || !activeItem.isIframe ? '' : overflow,
				'cursor', ''
			] );
			setStyle(
				[
					$fbResizer,
					thisBox.fbPrevPanel,
					thisBox.fbNextPanel,
					thisBox.fbPrev2,
					thisBox.fbNext2
				],
				'display', 'none'
			);
			sizeState = SIZE_native;

			// resizer, overlay nav, and useMaps
			if ( !collapsing ) {

				// components for image content
				if ( isImage ) {

					// resizer
					if ( $fbResizer ) {  // exists if enableImageResize option is not false

						// determine size state and target based on current conditions
						if ( mathMax(
								// content has been scaled up above its native size
								contentWrapperWidth - nativeWidth,
								contentWrapperHeight - nativeHeight,
								// or autoFit box is larger than current screen
								$fbMain.offsetWidth + autoFitSpace * 2 - viewport.width,
								$fbMain.offsetHeight + headerSpace + footerSpace - viewport.height,
								// or content is inframe-resized larger than the wrapper
								contentWidth - contentWrapperWidth,
								contentHeight - contentWrapperHeight
							) > 20
						) {
							sizeState = SIZE_large;
							cursor = zoomOutCursor;
						}

						// content is smaller than its native size
						else if (
							mathMin(
								contentWidth - nativeWidth,
								contentHeight - nativeHeight
							) < -32
						) {
							sizeState = SIZE_small;
							cursor = zoomInCursor;
						}

						// build the resizer if required
						if ( cursor ) {

							if ( resizeTool & OPT_one ) {  // show the resize cursor
								setStyle( $fbContent, 'cursor', cursor );
							}

							if ( resizeTool & OPT_two ) {
								// show the resize gadget and toggle the svg plus sign
								$fbResizer.firstChild.innerHTML = icons.zoom;
								setStyle( select( 'path', $fbResizer, -1 ),
									'display', sizeState == SIZE_large ? 'none' : ''
								);
								setStyle( $fbResizer, 'display', '' );
							}
						}
					}

					// useMap
					if ( $map && $map.id && $contentImg ) {

						areas = select( 'area', $map );
						i = areas.length;
						while ( i-- ) {
							if ( ( $area = areas[ i ] ) ) {

								dataCoords = attr( $area, 'data-coords' );
								coords = attr( $area, 'coords' );
								if ( /,/.test( coords ) ) {

									// capture original unscaled coordinates on the first visit
									if ( !dataCoords ) {
										dataCoords = patch( coords, /\s/g, '' );
										attr( $area, 'data-coords', dataCoords );
									}

									// scale coordinates to the image's new size
									coords = dataCoords.split( ',' );
									j = coords.length;
									while ( j-- ) {
										coords[ j ] = +coords[ j ] * (
											j % 2
											? contentHeight / $contentImg.height
											: contentWidth / $contentImg.width
										);
									}
									attr( $area, 'coords', coords.join( ',' ) );  // assign the scaled coordinates
								}
							}
						}

						attr( $fbContent, 'usemap', '#' + $map.id );
					}
				}

				// setup navOverlay (over any content type, but not inframe zoomed images)
				if ( navOverlay ) {

					if ( isImage && !usingTouch ) {  // for mousers viewing image content
						setStyle( [
								prevHref && thisBox.fbPrevPanel,
								nextHref && thisBox.fbNextPanel
							], [
								'width', ifNotSet( boxSettings.navOverlayWidth, 30 ) + '%',  // default 30
								'backgroundImage', 'url(' + blankGif + ')',  // enhances clickability
								'display', ''
							]
						);
					}

					if ( showNavOverlay ) {
						setStyle( [
								prevHref && thisBox.fbPrev2,
								nextHref && thisBox.fbNext2
							],
							[
								'top', ifNotSet( boxSettings.navOverlayPos, 33 ) + '%',
								'visibility', showNavOverlay === TRUE || !isImage ? '' : 'hidden',
								'display', ''
							]
						);
					}
				}

				// boxScroll (fixed positioning)
				setFixed( boxSettings.boxScroll === FALSE
					&& $fbMain.offsetWidth <= viewport.width
					&& $fbMain.offsetHeight <= viewport.height
				);

			}  // if !collapsing

			// make sure the outerClose button is within the viewport bounds
			layout = getLayout( thisBox.fbOuterClose );
			setStyle( thisBox.fbOuterClose, [  // slide it along an edge by setting margins
				'marginLeft', mathMax( 0,
					layout.margin.left - layout.left + 2
				),
				'marginTop', mathMax( 0,
					layout.margin.top - layout.top + 2
				),
				'marginRight', mathMax( 0,
					layout.margin.right - viewport.width + layout.right + 2
				)
			] );

			// slideshow viewing history and next timer
			if ( !activeItem.seen ) {
				activeItem.seen = TRUE;
				itemsShown++;
			}
			if ( isSlideshow && !activeItem.isVideo ) {
				setTimer( showItem,
					( boxSettings.slideInterval || 4.5 ) * 999,  // 4.5 second default
					TIMER_slideshow, boxTimeouts
				);
			}
		}  // postResize


		function restack () {
			// Change stack order of non-modal boxes.
			var
				topBox = getInstance(),
				topStack = topBox ? topBox.stackOrder : 0;

			if ( !isModal && thisBox.stackOrder < topStack ) {
				thisBox.stackOrder = topStack + 1;
				setZIndex();
			}
		}  // restack


		function putInlineBack ( item ) {
			// Saves inline content and captions back to the host page.
			var
				wrapperDivs = item.wrapperDivs.slice(),
				names = captionNames.slice(),
				i = names.length,
				name,
				$host;

			if ( item.isInline ) {
				// add fbContent to things to be moved
				names[ i ] = 'content';
				wrapperDivs[ i ] = item.contentWrapper;
				i++;
			}

			while ( i-- ) {
				name = names[ i ];
				if ( wrapperDivs[ i ]
					&& !(
						name == 'header'
						&& thisBox.state
						&& previousSettings.header == activeSettings.header
					)
					&& !(
						name == 'footer'
						&& thisBox.state
						&& previousSettings.footer == activeSettings.footer
					)
				) {
					$host = thisBox[ camelCase( 'fb-' + name ) ];
					moveElement( $host && $host.firstChild, wrapperDivs[ i ] );
				}
			}
		}  // putInlineBack


		function zoomOut ( then, phase ) {
			// Animated end down to a thumbnail
			var
				$fbFloater = thisBox.fbFloater,
				pad = outerBorder + innerBorder - zoomBorder;

			if ( !phase ) {
				if ( !fitContent( [ zoomOut, then, 1 ] ) ) {
					phase = 1;  // carry on
				}
			}

			if ( phase == 1 ) {

				// prep floater and place it over top of current content
				$fbFloater.src = zoomer;
				setStyle( $fbFloater, [
					$fbMain.offsetLeft + $fbContentWrapper.offsetLeft + pad,
					$fbMain.offsetTop + $fbContentWrapper.offsetTop + pad,
					$fbContent.offsetWidth,
					$fbContent.offsetHeight
				] );
				setStyle( $fbFloater, [
					'borderWidth', zoomBorder,
					'opacity', 0
				] );

				// opacity fade in if non-image content
				placeElement( $fbFloater, topDoc.body );
				animate( [
						[ $fbFloater, 'opacity', 1 ]
					],
					[ zoomOut, then, 2 ],
					activeItem.isImage && 0
				);
			}  // end phase 1

			if ( phase == 2 ) {

				// shrink box to behind fbFloater
				fadeTime = 0;
				collapse();
				setStyle( [
						$fbLiner,
						thisBox.fbHeader,
						thisBox.fbFooter,
						thisBox.fbOuterClose
					],
					'visibility', 'hidden'  // show only the empty box frame area
				);
				boxAnimate( [ 'fbMain',
						$fbFloater.offsetLeft,
						$fbFloater.offsetTop,
						$fbFloater.offsetWidth - outerBorderX2,
						$fbFloater.offsetHeight - outerBorderX2
					],
					[ zoomOut, then, 3 ],
					resizeTime,
					0, 1  // no easing
				);
			}  // end phase 2

			if ( phase == 3 ) {

				// turn off the box and shrink fbFloater down to the thumbnail or starting position
				setStyle( $fbMain, 'display', 'none' );
				startPos.$ = 'fbFloater';
				boxAnimate( startPos, then, resizeTime );
			}
		}  // zoomOut


		function destroy () {
			// Used box disposal service.
			var i;

			instances[ boxIndex ] = NULL;

			if ( !getInstance() ) {  // no more open boxes
				instances.length = 0;  // reset the sparse array
				while ( firstEvents.length ) {
					topFb.removeEvent( firstEvents.pop() );
				}
			}

			if ( !getInstance( NULL, TRUE ) ) {  // no more modal boxes
				// remove touch-pan restrictor put in place by boot
				setStyle( topDoc.documentElement, 'touchAction', '' );
			}

			// remove boxEvents
			while ( boxEvents.length ) {
				topFb.removeEvent( boxEvents.pop() );
			}

			// cancel any pending timers
			for ( i in boxTimeouts ) {
				clearTimer( i, boxTimeouts );
			}

			// pull any items 'owned' by this box out of the items array
			i = items.length;
			while ( i-- ) {
				if ( items[ i ] && items[ i ].ownerBox == thisBox ) {
					items[ i ] = NULL;
					// don't splice because indices are captured in .fbx link expando
				}
			}
			i = popups.length;  // popups too
			while ( i-- ) {
				if ( popups[ i ] && popups[ i ].ownerBox == thisBox ) {
					popups[ i ] = NULL;
				}
			}

			// make main page tabable again
			i = tabRestrictions.length;
			while ( i-- ) {
				attr( tabRestrictions[ i ], 'tabindex', tabIndices[ i ] );
			}
			tabRestrictions.length = 0;

			// dispose of the box elements
			while ( nodeNames.length ) {
				placeElement( thisBox[ nodeNames.pop() ] );
			}

			thisBox = {};
			$fbOverlay = $fbMain = $fbLiner = $fbContentWrapper = $fbContent = NULL;
		}  // destroy

		/// end Box service methods

		/// begin Box initialization

		var
			stackOrder = 0,
			i = instances.length,
			thatBox;

		// set stackOrder and parentBox
		while ( i-- ) {
			thatBox = instances[ i ];
			if ( thatBox ) {
				stackOrder = mathMax( stackOrder, thatBox.stackOrder );
				if ( isModal && !parentBox && thatBox.state && thatBox.isModal ) {
					parentBox = thatBox;  // parentBox is the top-most modal box beneath this modal box
				}
			}
		}
		stackOrder += 1;

		// register on the top.fb.data.instances array
		instances.push( thisBox );

		// expose Box public methods and properties
		return extend( thisBox, {  // per box
			// api methods
			showItem: showItem,
			resize: resize,
			pause: pause,
			reload: reload,
			goBack: goBack,
			end: end,
			// service methods
			boot: boot,  // called only from start
			restack: restack,  // for start
			keydownHandler: keydownHandler,  // for itself
			// properties
			isModal: isModal,
			stackOrder: stackOrder
		} );

		/// end Box initialization
	}  // newBox

///  end Box object

	data.coreInit = function () {
		// floatbox.js will call coreInit after DOM is ready and document is activated.

		// top window references and data to support boxes attaching there
		topWin = !settings.baseSettings.framed	&& getOwnerWindow( self.top );  // x-domain check
		if ( !( topWin && topWin.fb && topWin.fb.path == fb.path ) ) {
			topWin = self;
		}
		topDoc = topWin.document;
		topFb = topWin.fb;
		topData = topFb.data;
		topUrl = topData.locationUrl;
		newElement = topData.newElement;
		tapDetails = topData.tapDetails;  // tapHandler keeps its record of what's going on here
		viewport = topData.viewport;  // maintained by viewportHandler
		visualOffset = topData.visualOffset;  // ditto
		clientOffset = topData.clientOffset;  // ditto
		firstEvents = topData.firstEvents;  // to be cleaned up when the last or only box is closed
		offHints = topData.offHints;  // hints (browser tooltips) that are off because they've been seen
		items = topData.items;
		instances = topData.instances;

		// set some common vars that depend on floatbox.js:init having run
		baseSettings = extend( {}, topData.settings.baseSettings, settings.baseSettings );
		classSettings = extend( {}, topData.settings.classSettings, settings.classSettings );
		typeSettings = extend( {}, topData.settings.typeSettings, settings.typeSettings );
		resourcesFolder = fbPath + 'resources/';
		blankGif = resourcesFolder + 'blank.gif';
		waitGif = resourcesFolder + 'wait.gif';
		zoomInCursor = 'url(' + resourcesFolder + 'zoom-in.cur),default';
		zoomOutCursor = patch( zoomInCursor, 'zoom-in', 'zoom-out' );  // IE doesn't do native zoom cursors
		contextClass = baseSettings.contextClass || 'fbContext';
		tooltipClass = baseSettings.tooltipClass || 'fbTooltip';
		cyclerClass = baseSettings.cyclerClass || 'fbCycler';
		preloadLimit = getInt( baseSettings.preloadLimit ) || 5;

		// browser detects
		isWebkit = 'WebkitAppearance' in document.body.style;
		isIos = isWebkit && /^iP/.test( self.navigator.platform );
		isMac = /^Mac/.test( self.navigator.platform );

		// temporary div for feature detection
		var tempDiv = newElement( 'div' );
		setStyle( tempDiv, [
			'top', -bigNumber,
			'width', 77,
			'height', 77,
			'position', 'absolute',
			'overflow', 'scroll'
		] );
		placeElement( tempDiv, document.body );
		scrollbarSize = tempDiv.offsetWidth - tempDiv.clientWidth || 0;
		placeElement( tempDiv );

		// set strings from language localization file or default English
		getStrings( patch(
			( baseSettings.language
				|| attr( topDoc.documentElement, 'lang' )
				|| 'en'
			).toLowerCase(),
			/^(\w+).*/i, '$1'
		) );

		// populate the svg icons array
		getIcons();

		// expose some more api functions defined here in core
		extend( fb, {
			activate: activate,
			getFormValues: getFormValues,
			getLayout: getLayout,
			getViewport: getViewport,
			getStyle: getStyle,
			setStyle: setStyle,
			getInstance: getInstance,
			getOwnerInstance: getOwnerInstance,
			nodeContains: nodeContains,
			printNode: printNode,
			parseJSON: parseJSON,
			icons: icons,  // object, not function
			getByClass: getByClass,  // legacy
			getScroll: getViewport,  // legacy
			// deferred from floatbox.js
			start: start,
			ajax: ajax,
			animate: animate,
			preload: preload,
			// per-box functions hooked up to fb.api calls
			showItem: runFromTopBox( 'showItem' ),
			resize: runFromTopBox( 'resize' ),
			pause: runFromTopBox( 'pause' ),
			reload: runFromTopBox( 'reload' ),
			goBack: runFromTopBox( 'goBack' ),
			end: runFromTopBox( 'end' )
		} );

		// tapHandler monitors user input and rationalizes touch event sequences
		// also handles outsideClickCloses
		addEvent( document, [
				'touchstart',
				'mousedown',
				'keydown',
				'touchend',
				'mouseup'
			],
			tapHandler, TRUE  // important to catch things early in the capturing phase
		);

		if ( topWin == self ) {

			// keep track of viewport scroll and size changes, and keepCentered trigger
			addEvent( topWin, [ 'resize', 'scroll' ], viewportHandler );
			viewportHandler();  // initialize the metrics

			// messageHandler for x-domain iframe communication
			addEvent( topWin, 'message', messageHandler );
		}

		data.activateItem = activateItem;  // replace the defered function with the real one
		data.fbIsReady = TRUE;
		fb.ready( [ activate, FALSE ] );  // release the deferred queue and activate
		preload( [ blankGif, waitGif ] );
		maybeStart( showAtLoad );

	};  // coreInit

} )( true, false, null );
