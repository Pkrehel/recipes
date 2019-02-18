var express = require("express"),
    router = express.Router(),
    passport = require("passport"),
    User = require("../models/user"),
    Recipe = require("../models/recipe"),
    randomstring = require("randomstring"),
    nodemailer = require('nodemailer'),
    async = require('async'),
    crypto = require('crypto');

//Show the home page
router.get("/", function (req, res) {
    //SEARCH BOX:
    var queryString = req.query.search;
    if (queryString) {
        var regex = new RegExp(escapeRegex(queryString), 'gi');
        Recipe.find({ $or: [{ "title": regex }, { "tags": regex }, { "category": regex }, { "ingredients": regex }] }).limit(12).exec(function (err, foundRecipe) {
            if (err) {
                console.log(err);
            }
            else {
                if (foundRecipe.length < 1) {
                    console.log("no results");
                    req.flash("error", "No results for \"" + queryString + "\". Please search again.");
                    res.redirect("/");
                }
                res.render("home", { foundRecipe: foundRecipe });
                // checks if a user is logged in. If so, Update current user's search array
                if (req.user) {
                    User.findByIdAndUpdate(req.user.id, { $push: { 'searches': queryString } }, function (err, foundUser) {
                        if (err) {
                            req.flash("error", "An Error Occurred. Please search again.");
                            res.redirect("back");
                        }
                        else {
                            foundUser.save();
                            console.log("### --> added " + queryString + " to search history for " + foundUser);
                        }
                    });
                }
            }
        });
    }
    else {
        Recipe.find({}).sort({ createdAt: -1 }).limit(12).exec(function (err, latestRecipes) {
            if (err) {
                res.send(latestRecipes);
                // console.log(err);
            }
            else {
                res.render("home", { latestRecipes: latestRecipes });
            }
        });
    }
});

//===================
// USER REGISTRATION:
//===================

//Show the signup page
router.get("/register", function (req, res) {
    res.render("register", { message: req.flash("signupMessage") });
});

//REGISTER LOGIC:
router.post("/register", function (req, res) {
    var newUser = new User({
        username: req.body.username,
        screenName: req.body.screenName,
        avatar: req.body.avatar,

        // Randomstring Generation
        secretToken: randomstring.generate(),

        // Flag account as inactive
        active: false
    });
    User.register(newUser, req.body.password, function (err, user) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("register");
        }
        passport.authenticate("local")(req, res, function () {
            req.flash("success", "Your account is almost finsihed! Please check " + user.username + " to complete your account.");
            res.redirect("/verification-email");
        });
    });
});

// Send Verification Email After Account SignUp:
var mailOptions, host, link;

router.get("/verification-email", function (req, res) {
    host = req.get("host");
    link = "https://palmer-krehel-palmerkrehel.c9users.io" + "/verify?id=" + req.user.secretToken;
    var smtpTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            clientId: process.env.NODEMAILER_CLIENTID,
            clientSecret: process.env.NODEMAILER_CLIENTSECRET,
            user: process.env.NODEMAILER_USER,
            refreshToken: process.env.NODEMAILER_REFRESHTOKEN,
            accessToken: process.env.NODEMAILER_ACCESSTOKEN,
            expires: process.env.NODEMAILER_EXPIRES
        }
    });

    mailOptions = {
        from: process.env.TESTEMAILADDRESS,
        to: req.user.username,
        subject: "Please Confirm Your Email Account",
        html: "Hello, <br> Please confirm your email by clicking the link below: <br><a href=" + link + ">Click here to verify your account.</a>",
    };
    console.log(mailOptions);
    smtpTransporter.sendMail(mailOptions, function (err, response) {
        if (err) {
            console.log("error with email transport");
            console.log(err);
            res.send(err);
        }
        else {
            console.log("message sent");
            req.flash("success", "A confirmation email has been sent to " + req.user.username + ". Please check your email to complete your account.");
            req.logout();
            res.redirect("/register");
        }
    });
});

router.get("/verify", function (req, res) {
    console.log(req.protocol + ":/" + req.get("host"));
    if ((req.protocol + "://" + req.get("host")) == ("http://" + host)) {
        console.log("Domain is matched. Information is from authentic email address");

        User.findOneAndUpdate(req.query.id, { $set: { active: true, secretToken: "" } }, function (err, user) {
            if (err) {
                req.flash("error", "An Error Has Occurred. Please Try Again.");
                res.redirect("/register");
            }
            else {
                user.save();
                req.flash("success", "Your email has been verified.");
                res.redirect("/");
            }
        });
    }
});
// End of email send / verification process


router.get("/login", function (req, res) {
    res.render("login");
});


//handle login logic:
router.post('/login',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })
);


// LOGOUT LOGIC
router.get("/logout", function (req, res) {
    req.logout();
    req.flash("success", "You have been successfully logged out.");
    res.redirect("/");
});

// Forgot Password Logic
router.get("/forgot", function (req, res) {
    res.render("forgot");
});

router.post('/forgot', function (req, res, next) {
    async.waterfall([
        function (done) {
            crypto.randomBytes(20, function (err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        function (token, done) {
            User.findOne({ username: req.body.email }, function (err, user) {
                if (!user) {
                    req.flash('error', 'No account with that email address exists.');
                    return res.redirect('/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
        },
        function (token, user, done) {
            var smtpTransporter1 = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    type: 'OAuth2',
                    clientId: process.env.NODEMAILER_CLIENTID,
                    clientSecret: process.env.NODEMAILER_CLIENTSECRET,
                    user: process.env.NODEMAILER_USER,
                    refreshToken: process.env.NODEMAILER_REFRESHTOKEN,
                    accessToken: process.env.NODEMAILER_ACCESSTOKEN,
                    expires: process.env.NODEMAILER_EXPIRES
                }
            });

            var mailOptions = {
                to: user.username,
                from: process.env.TESTEMAILADDRESS,
                subject: 'Please Reset Your Password',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };

            smtpTransporter1.sendMail(mailOptions, function (err) {
                console.log('mail sent');
                req.flash('success', 'An e-mail has been sent to ' + user.username + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function (err) {
        if (err) return next(err);
        res.redirect('forgot');
    });
});


router.get('/reset/:token', function (req, res) {
    console.log(req.params.token);
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('reset', { token: req.params.token });
    });
});

router.post('/reset/:token', function (req, res) {
    console.log(req.params.token);
    async.waterfall([
        function (done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
                console.log(user);
                if (!user) {
                    req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('back');
                }
                if (req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function (err) {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;

                        user.save(function (err) {
                            req.logIn(user, function (err) {
                                done(err, user);
                            });
                        });
                    });
                }
                else {
                    req.flash("error", "Passwords do not match.");
                    return res.redirect('back');
                }
            });
        },
        function (user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: process.env.TESTEMAILADDRESS,
                    pass: process.env.TESTEMAILPASSWORD
                }
            });
            var mailOptions = {
                to: user.username,
                from: process.env.TESTEMAILADDRESS,
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.username + ' has just been changed.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                console.log('mail sent');
                req.flash('success', 'An e-mail has been sent to ' + user.username + ' for confirmation.');
                done(err, 'done');
            });
        }
    ], function (err) {
        res.redirect('/forgot');
    });
});



//USER PUBLIC PROFILE ROUTES:
router.get("/users/:id", function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        if (err) {
            req.flash("error", "Cannot Find User's Profile");
            res.redirect("/");
        }
        res.render("users/public", { user: foundUser });
    });
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
