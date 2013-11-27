define('MattRudder.Facebook', ['jquery'], function ($) {
	var appId = '140457574565';

	return {
		init: function (window) {
			// Load the SDK Asynchronously
			(function (d) {
				var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
				if (d.getElementById(id)) { return; }
				js = d.createElement('script'); js.id = id; js.async = true;
				js.src = "//connect.facebook.net/en_US/all.js";
				ref.parentNode.insertBefore(js, ref);
			}(document));

			// Init the SDK upon load
			window.fbAsyncInit = function () {
				$(function () {
					var $displayName = $('#auth-displayname'),
						$loginLink = $('#auth-loginlink'),
						$logoutLink = $('#auth-logoutlink'),
						$loggedIn = $('#auth-loggedin'),
						$loggedOut = $('#auth-loggedout');

					FB.init({
						appId: appId, // App ID
						channelUrl: '//' + window.location.hostname + '/fb-channel', // Path to your Channel File
						status: true, // check login status
						cookie: true, // enable cookies to allow the server to access the session
						xfbml: true  // parse XFBML
					});

					// listen for and handle auth.statusChange events
					FB.Event.subscribe('auth.statusChange', function (response) {
						if (response.authResponse) {
							// user has auth'd your app and is logged into Facebook
							FB.api('/me', function (me) {
								var accessToken = null;

								if (me.name) {
									$displayName.text(me.name);

									FB.api('/me/accounts', function (acct) {
										var i, account;
										for (i = 0; i < acct.data.length; ++i) {
											account = acct.data[i];

											if (account.id === appId) {
												accessToken = account.access_token;
											}
										}

										if (accessToken) {
											FB.api('/' + appId + '/roles?access_token=' + accessToken, function (obj) {
												console.log(obj);
											});
										}
									});
								}

								$loggedOut.hide();
								$loggedIn.show();
							});


						} else {
							// user has not auth'd your app, or is not logged into Facebook
							$loggedOut.show();
							$loggedIn.hide();
						}
					});

					// respond to clicks on the login and logout links
					$loginLink
						.on('click', function () {
							FB.login();
						});

					$logoutLink
						.on('click', function () {
							FB.logout();
						});
				});
			}
		}
	};
});