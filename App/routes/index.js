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
router.get("/", function(req, res) {
    var query = {}
    var pageTitle = req.query.pageTitle
    var difficulty = req.query.difficulty
    var perPage
    var pageLimit = parseInt(req.query.pageLimit);
    var sort
    var sortBy = req.query.sortBy
    var orderBy = req.query.orderBy
    var lessThan = parseInt(req.query.lt)
    var greaterThan = parseInt(req.query.gt)
    var category = req.query.category
    var allergens = req.query.allergens

    //PARSING QUERY STRING VALUES:
    var queryString = '?'
    var urlParamObj = Object.entries(req.query)
    for (let key in urlParamObj) {
        var value = urlParamObj[key].toString();
        value = value.replace(',', '=')
        queryString = queryString.concat('&' + value)
    }
    queryString = queryString.replace('?&', '?')

    if (pageLimit) {
        if (pageLimit <= 12) {
            perPage = pageLimit
        } else {
            perPage = 6
        }
    } else {
        perPage = 6
    }

    if (!orderBy) {
        orderBy = "createdAt"
    }

    if (sortBy === '1') {
        sort = "" + orderBy
    } else {
        sort = '-' + orderBy
    }

    if (difficulty) {
        query['difficulty'] = difficulty
    }

    if (lessThan && greaterThan) {
        query['totalTime'] = {
            $gt: greaterThan,
            $lt: lessThan
        }
    }

    if (lessThan && !greaterThan) {
        query['totalTime'] = {
            $lt: lessThan
        }
    }

    if (!lessThan && greaterThan) {
        query['totalTime'] = {
            $gt: greaterThan
        }
    }

    if (category) {
        query['category'] = category
    }

    if (allergens) {
        query['allergens'] = allergens
    }


    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    Recipe.find(query).skip((perPage * pageNumber) - perPage).limit(perPage).sort(sort.toString()).exec(function(err, latestRecipes) {
        Recipe.count(query).exec(function(err, count) {
            if (err) {
                req.flash("error", "Sorry, an error has occurred.");
                res.redirect("back");
            } else {
                res.render("home", {
                    latestRecipes: latestRecipes,
                    current: pageNumber,
                    pages: Math.ceil(count / perPage),
                    noMatch: noMatch,
                    search: false,
                    perPage: perPage,
                    pageTitle: pageTitle,
                    queryString: queryString
                });
            }
        });
    });
});

router.get("/s", function(req, res) {
    var perPage
    var pageLimit = parseInt(req.query.pageLimit);
    if (pageLimit) {
        if (pageLimit <= 12) {
            perPage = pageLimit
        } else {
            perPage = 6
        }
    } else {
        perPage = 6
    }

    var orderBy = req.query.orderBy
    var sort
    var sortBy = req.query.sortBy
    if (sortBy === '1') {
        sort = "" + orderBy
    } else {
        sort = '-' + orderBy
    }
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    var queryString = req.query.search;
    var regex = new RegExp(escapeRegex(queryString), 'gi');
    Recipe.find({
        $or: [{
            "title": regex
        }, {
            "tags": regex
        }, {
            "category": regex
        }, {
            "ingredients": regex
        }, {
            "directions": regex
        }, {
            "description": regex
        }, {
            "allergens": regex
        }]
    }).skip((perPage * pageNumber) - perPage).limit(perPage).sort(sort.toString()).exec(function(err, foundRecipe) {
        Recipe.count({
            $or: [{
                "title": regex
            }, {
                "tags": regex
            }, {
                "category": regex
            }, {
                "ingredients": regex
            }, {
                "directions": regex
            }, {
                "description": regex
            }, {
                "allergens": regex
            }]
        }).exec(function(err, count) {
            if (err) {
                req.flash("error", "Sorry, an error has occurred.");
                res.redirect("back");
            } else {
                if (foundRecipe.length == 0 || queryString.length == 0) {
                    req.flash("error", "No results for \"" + queryString + "\". Please update your search and try again.");
                    res.redirect("back");
                } else {
                    if (req.user) {
                        User.findByIdAndUpdate(req.user.id, {
                            $push: {
                                'searches': queryString
                            }
                        }, function(err, foundUser) {
                            if (err) {
                                req.flash("error", "An Error Occurred. Please search again.");
                                res.redirect("back");
                            } else {
                                foundUser.save();
                                res.render("search", {
                                    foundRecipe: foundRecipe,
                                    current: pageNumber,
                                    pages: Math.ceil(count / perPage),
                                    noMatch: noMatch,
                                    search: queryString,
                                    perPage: perPage
                                });
                            }
                        });
                    } else {
                        res.render("search", {
                            foundRecipe: foundRecipe,
                            current: pageNumber,
                            pages: Math.ceil(count / perPage),
                            noMatch: noMatch,
                            search: queryString,
                            perPage: perPage,
                        });
                    }
                }
            }
        });
    });
});

//===================
// USER REGISTRATION:
//===================

//Show the signup page
router.get("/register", function(req, res) {
    res.render("register", {
        message: req.flash("signupMessage")
    });
});

//REGISTER LOGIC:
router.post("/register", function(req, res) {
    // var date = new Date()
    var newUser = new User({
        username: req.body.username,
        // date.getFullYear().toString() + "-" + (date.getMonth()+1).toString() + "-" +  date.getDate().toString() + "-" + date.getHours().toString() + "-" + date.getMinutes().toString() + "-" + date.getSeconds().toString() + "-" + randomstring.generate(),
        screenName: req.body.screenName,
        avatar: req.body.avatar,
        firstName: req.body.firstName,
        favoriteCategories: req.body.favoriteCategories,
        // Randomstring Generation
        secretToken: randomstring.generate(),

        // Flag account as not verified
        verified: false
    });
    User.register(newUser, req.body.password, function(err, user) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("register");
        }
        passport.authenticate("local")(req, res, function() {
            req.flash("success", "Your account is almost finsihed! Please check " + user.email + " to complete your account.");
            res.redirect("/verification-email");
        });
    });
});

//USER PROFILE UPDATE ROUTES:
router.put("/users/:id/update", function(req, res) {
    User.findById(req.params.id, function(err, foundUser) {
        if (err) {
            req.flash("error", "Cannot Find User's Profile.");
            res.redirect("back");
        }
        // If user changes email address on profile page
        if (foundUser.username !== req.body.username) {
                foundUser.username = req.body.username,
                foundUser.secretToken = randomstring.generate(),
                foundUser.screenName = req.body.screenName,
                foundUser.avatar = req.body.avatar,
                foundUser.firstName = req.body.firstName,
                foundUser.verified = false,
                foundUser.save(function(err) {
                    if (err) {
                        console.log(err);
                        return res.redirect("/");
                    }
                    req.flash("success", "Please check " + req.body.username + " to reactivate your email.");
                    return res.redirect("/verification-email");
                });
        } else {
            // If user does not change email address on profile page
            console.log("Update user - email not changed");
            foundUser.username = req.body.username,
                foundUser.screenName = req.body.screenName,
                foundUser.avatar = req.body.avatar,
                foundUser.firstName = req.body.firstName,
                foundUser.save()
            req.flash("success", "Your account has been updated!");
            res.redirect("back");
        }
    });
});

// Send Verification Email After Account SignUp:
var mailOptions, host, link;

router.get("/verification-email", function(req, res) {
    host = req.get("host");
    link = "localhost:3000" + "/verify?id=" + req.user.secretToken;
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
        html: "Hello, <br> Please confirm your email by clicking the link below: <br>" + link

    };
    console.log(mailOptions);
    smtpTransporter.sendMail(mailOptions, function(err, response) {
        if (err) {
            console.log("error with email transport");
            console.log(err);
            res.send(err);
        } else {
            console.log("message sent");
            req.flash("success", "A confirmation email has been sent to " + req.user.username + ". Please check your email to complete your account.");
            req.logout();
            res.redirect("/register");
        }
    });
});



router.get("/verify", function(req, res) {
    console.log(req.protocol + ":/" + req.get("host"));
    if ((req.protocol + "://" + req.get("host")) == ("http://" + host)) {
        console.log("Domain is matched. Information is from authentic email address");

        User.findOneAndUpdate(req.query.id, {
            $set: {
                active: true,
                secretToken: ""
            }
        }, function(err, user) {
            if (err) {
                req.flash("error", "An Error Has Occurred. Please Try Again.");
                res.redirect("/register");
            } else {
                user.save();
                req.flash("success", "Your email has been verified.");
                res.redirect("/");
            }
        });
    }
});
// End of email send / verification process

router.get("/login", function(req, res) {
    res.render("login");
});


//handle login logic:
// router.post('/login',
//     passport.authenticate('local', {
//         successRedirect: '/',
//         failureRedirect: '/login',
//         failureFlash: true
//     })
// );


router.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login',failureFlash: true}),
  function(req, res) {
    console.log(req.user);
  });


// LOGOUT LOGIC
router.get("/logout", function(req, res) {
    req.logout();
    req.flash("success", "You have been successfully logged out.");
    res.redirect("/");
});

// Forgot Password Logic
router.get("/forgot", function(req, res) {
    res.render("forgot");
});

router.post('/forgot', function(req, res, next) {
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        function(token, done) {
            User.findOne({
                username: req.body.email
            }, function(err, user) {
                if (!user) {
                    req.flash('error', 'No account with that email address exists.');
                    return res.redirect('/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function(err) {
                    done(err, token, user);
                });
            });
        },
        function(token, user, done) {
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
                text: 'You are receiving this because you have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'https://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };

            smtpTransporter1.sendMail(mailOptions, function(err) {
                console.log('mail sent');
                req.flash('success', 'An e-mail has been sent to ' + user.username + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function(err) {
        if (err) return next(err);
        res.redirect('forgot');
    });
});

router.get('/reset/:token', function(req, res) {
    console.log(req.params.token);
    User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function(err, user) {
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('reset', {
            token: req.params.token
        });
    });
});

router.post('/reset/:token', function(req, res) {
    console.log(req.params.token);
    async.waterfall([
        function(done) {
            User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            }, function(err, user) {
                console.log(user);
                if (!user) {
                    req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('back');
                }
                if (req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function(err) {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;

                        user.save(function(err) {
                            req.logIn(user, function(err) {
                                done(err, user);
                            });
                        });
                    });
                } else {
                    req.flash("error", "Passwords do not match.");
                    return res.redirect('back');
                }
            });
        },
        function(user, done) {
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
            smtpTransport.sendMail(mailOptions, function(err) {
                console.log('mail sent');
                req.flash('success', 'An e-mail has been sent to ' + user.username + ' for confirmation.');
                done(err, 'done');
            });
        }
    ], function(err) {
        res.redirect('/forgot');
    });
});

//USER PROFILE ROUTES:
router.get("/users/:id", function(req, res) {
    User.findById(req.params.id).populate("recipes lovedRecipes").exec(function(err, foundUser) {
        if (err) {
            req.flash("error", "Cannot Find User's Profile.");
            res.redirect("back");
        }
        res.render("users/profile", {
            foundUser: foundUser
        });
    });
});


function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;