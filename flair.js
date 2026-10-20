/* Sagebrush Studio LLC: flair layer. Plain JavaScript, no dependencies.
   Every effect is skipped for visitors who prefer reduced motion.

   Loaded with "defer" by the seven main pages only (not the case studies or
   concept sites). Each section below looks for its own elements first and does
   nothing if they are missing, so one shared file can serve every page:
     1. Scroll-in reveals        (all pages)
     2. Device-mockup tilt       (Home, Work)
     3. "Try a style" demo       (Home)
     4. Concept-work carousel    (Home)
     5. Floating quote button    (all pages except Contact)
     6. Photo-band parallax      (Home)
     7. Contact form             (Contact)
     8. Scroll progress bar      (all pages)
   Everything is wrapped in one function so no variables leak into the page. */
(function () {
  "use strict";

  // True when the visitor's system asks for less motion; every animation checks this.
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll-in reveals ---------- */
  // Elements that fade and slide up the first time they scroll into view.
  var REVEAL = [
    ".section-head", ".work-card", ".process-card", ".process-note", ".work-note",
    ".about-arch", ".about-copy", ".skill-chip", ".fact", ".contact-info",
    ".contact-grid form"
  ].join(",");

  if (!reduceMotion && "IntersectionObserver" in window) {
    // Counts how many siblings of each parent have been seen so far, so a row of
    // cards animates one after another (a stagger) instead of all at once.
    var seen = new Map();
    var targets = Array.prototype.slice.call(document.querySelectorAll(REVEAL));

    targets.forEach(function (el) {
      var parent = el.parentElement;
      var index = seen.get(parent) || 0;
      seen.set(parent, index + 1);
      // Delay grows 0.08s per sibling, capped at 6 steps so long lists do not lag.
      el.style.setProperty("--d", Math.min(index, 6) * 0.08 + "s");
      // The hidden starting state (.reveal) is added here, not in the HTML, so
      // nothing stays invisible if this script fails to run.
      el.classList.add("reveal");
    });

    // Fire when 12% of an element is visible, slightly before it reaches the bottom edge.
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          observer.unobserve(el); // each element reveals only once
          el.classList.add("in");
          // Hand control back to the element's own hover transitions.
          el.addEventListener("transitionend", function done(event) {
            if (event.propertyName !== "opacity") return;
            el.removeEventListener("transitionend", done);
            el.classList.remove("reveal", "in");
            el.style.removeProperty("--d");
          });
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Device mockup tilt (pointer devices only) ---------- */
  // Moving the mouse over a browser/phone mockup rotates it slightly in 3D.
  // Skipped on touch screens, where there is no hover to follow.
  if (!reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll("[data-tilt]").forEach(function (stage) {
      var rig = stage.querySelector(".device-rig");
      if (!rig) return;
      stage.addEventListener("pointermove", function (event) {
        var box = stage.getBoundingClientRect();
        // Pointer position inside the stage as -0.5 (left/top) to +0.5 (right/bottom).
        var x = (event.clientX - box.left) / box.width - 0.5;
        var y = (event.clientY - box.top) / box.height - 0.5;
        // .is-tilting switches to a short transition so the tilt tracks the cursor closely.
        rig.classList.add("is-tilting");
        rig.style.setProperty("--ry", (x * 14).toFixed(2) + "deg");
        rig.style.setProperty("--rx", (-y * 10).toFixed(2) + "deg");
      });
      stage.addEventListener("pointerleave", function () {
        rig.classList.remove("is-tilting");
        rig.style.setProperty("--ry", "0deg");
        rig.style.setProperty("--rx", "0deg");
      });
    });
  }

  /* ---------- "Try a style" demo ---------- */
  // The radio buttons restyle a sample salon page by changing its data-style
  // attribute (the styles themselves live in flair.css).
  var lab = document.getElementById("style-lab");
  if (lab) {
    // The section is "hidden" in the HTML and revealed here, because the
    // controls do nothing without JavaScript.
    lab.hidden = false;
    var mock = document.getElementById("mock");
    var gallery = document.getElementById("mock-gallery");
    var labName = document.getElementById("lab-name");
    var labDesc = document.getElementById("lab-desc");
    var labLink = document.getElementById("lab-link");

    // Apply one style: swap the sample page's look, update the caption and link
    // (all read from data-* attributes on the radio button), and replay the tile animation.
    var applyStyle = function (input) {
      mock.setAttribute("data-style", input.value);
      labName.textContent = input.getAttribute("data-title");
      labDesc.textContent = input.getAttribute("data-desc");
      labLink.setAttribute("href", input.getAttribute("data-href"));
      labLink.innerHTML = "See it on " + input.getAttribute("data-site") + " &rarr;";
      if (!reduceMotion) {
        gallery.classList.remove("pop");
        void gallery.offsetWidth; // reading offsetWidth forces a reflow so the animation can restart
        gallery.classList.add("pop");
      }
    };

    Array.prototype.forEach.call(lab.querySelectorAll('input[name="lab-style"]'), function (input) {
      input.addEventListener("change", function () {
        if (input.checked) applyStyle(input);
      });
    });
  }

  /* ---------- Concept-work carousel ---------- */
  // Without JavaScript the four concept sites simply stack as a list. With it,
  // they become a carousel: one slide visible, Previous/Next buttons, dots,
  // auto-rotation, and a Pause/Play button.
  var showcase = document.getElementById("showcase");
  if (showcase) {
    var slides = Array.prototype.slice.call(showcase.querySelectorAll(".slide"));
    var body = showcase.querySelector(".showcase-body");
    if (slides.length > 1 && body) {
      showcase.classList.add("is-carousel"); // CSS stacks the slides on top of each other
      var current = 0;                  // index of the visible slide
      var playing = !reduceMotion;      // auto-rotation starts off for reduced-motion visitors
      var hovering = false;             // mouse is over the carousel (pauses rotation)
      var focusing = false;             // keyboard focus is inside the carousel (pauses rotation)
      var timer = null;                 // setInterval handle for auto-rotation

      // Build the controls in JS (they would be dead buttons without it).
      var controls = document.createElement("div");
      controls.className = "carousel-controls";

      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "carousel-btn";
      prev.setAttribute("aria-label", "Previous concept site");
      prev.innerHTML = "&lsaquo;";

      var dotsWrap = document.createElement("div");
      dotsWrap.className = "carousel-dots";
      var dots = slides.map(function (slide, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", "Show concept site " + (i + 1) + " of " + slides.length);
        dot.addEventListener("click", function () { show(i); tick(); });
        dotsWrap.appendChild(dot);
        return dot;
      });

      var next = document.createElement("button");
      next.type = "button";
      next.className = "carousel-btn";
      next.setAttribute("aria-label", "Next concept site");
      next.innerHTML = "&rsaquo;";

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "carousel-toggle";

      controls.appendChild(prev);
      controls.appendChild(dotsWrap);
      controls.appendChild(next);
      controls.appendChild(toggle);
      body.appendChild(controls);

      // Show one slide: wrap the index around, mark that slide active, and make the
      // others inert so keyboard and screen-reader users cannot reach hidden links.
      var show = function (index) {
        current = (index + slides.length) % slides.length;
        slides.forEach(function (slide, i) {
          var active = i === current;
          slide.classList.toggle("is-active", active);
          if (active) { slide.removeAttribute("inert"); } else { slide.setAttribute("inert", ""); }
          dots[i].setAttribute("aria-current", active ? "true" : "false");
        });
      };

      // (Re)start the rotation timer. It only runs while playing and not hovered,
      // focused, or in a background tab; every other event calls tick() to re-evaluate.
      var tick = function () {
        if (timer) { window.clearInterval(timer); timer = null; }
        if (playing && !hovering && !focusing && !document.hidden) {
          timer = window.setInterval(function () { show(current + 1); }, 5500);
        }
      };

      // Keep the Pause/Play label correct, and let assistive tech announce slide
      // changes only while rotation is paused (announcing every 5.5s would be noisy).
      var syncToggle = function () {
        toggle.textContent = playing ? "Pause rotation" : "Play rotation";
        body.setAttribute("aria-live", playing ? "off" : "polite");
      };

      prev.addEventListener("click", function () { show(current - 1); tick(); });
      next.addEventListener("click", function () { show(current + 1); tick(); });
      toggle.addEventListener("click", function () { playing = !playing; syncToggle(); tick(); });
      body.addEventListener("pointerenter", function () { hovering = true; tick(); });
      body.addEventListener("pointerleave", function () { hovering = false; tick(); });
      // Only keyboard focus pauses the rotation, so pressing Play with a mouse really plays.
      body.addEventListener("focusin", function (event) {
        focusing = !!(event.target.matches && event.target.matches(":focus-visible"));
        tick();
      });
      body.addEventListener("focusout", function () { focusing = false; tick(); });
      document.addEventListener("visibilitychange", tick);

      show(0);
      syncToggle();
      tick();
    }
  }

  /* ---------- Floating "Get a free quote" button ---------- */
  // Added to every page except Contact (where it would point at the page you are on).
  if (!/contact/i.test(window.location.pathname)) {
    var quote = document.createElement("a");
    quote.className = "quote-fab";
    quote.href = "contact.html";
    quote.textContent = "Get a free quote";
    document.body.appendChild(quote);

    var quoteShown = false;
    var quoteBand = document.getElementById("photo-band");
    var checkQuote = function () {
      var shouldShow = window.scrollY > 480; // appears after scrolling past the first screen
      if (shouldShow && quoteBand) {
        // The band has its own button, so don't show two quote buttons at once.
        var box = quoteBand.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) shouldShow = false;
      }
      if (shouldShow !== quoteShown) {
        quoteShown = shouldShow;
        quote.classList.toggle("is-shown", shouldShow);
      }
    };
    window.addEventListener("scroll", checkQuote, { passive: true });
    checkQuote();
  }

  /* ---------- Photo band parallax ---------- */
  // The four photos in the Home page band drift slightly as it scrolls past.
  var band = document.getElementById("photo-band");
  if (band && !reduceMotion) {
    var bandImgs = Array.prototype.slice.call(band.querySelectorAll(".band-photos img"));
    var bandTicking = false;
    var driftBand = function () {
      bandTicking = false;
      var box = band.getBoundingClientRect();
      var vh = window.innerHeight;
      if (box.bottom < 0 || box.top > vh) return;
      var progress = (vh / 2 - (box.top + box.height / 2)) / vh; // about -0.5 .. 0.5
      bandImgs.forEach(function (img, i) {
        // Alternate photos drift in opposite directions for a layered look.
        var direction = i % 2 ? -1 : 1;
        img.style.setProperty("--py", (progress * 28 * direction).toFixed(1) + "px");
      });
    };
    // Throttle to one update per animation frame so scrolling stays smooth.
    window.addEventListener("scroll", function () {
      if (!bandTicking) {
        bandTicking = true;
        window.requestAnimationFrame(driftBand);
      }
    }, { passive: true });
    driftBand();
  }

  /* ---------- Contact form ----------
     No server: the form validates, then builds a mailto: link so the message
     goes through the visitor's own email app. It is hidden in the HTML and
     shown here, so it never appears as a dead control when JavaScript is off. */
  var contactForm = document.getElementById("contact-form");
  var mailLink = document.querySelector('.contact-info a[href^="mailto:"]');

  if (contactForm && mailLink) {
    // The destination address is read from the visible mailto link, so it is only written once in the HTML.
    var toAddress = mailLink.getAttribute("href").replace(/^mailto:/i, "");
    var nameField = document.getElementById("cf-name");
    var emailField = document.getElementById("cf-email");
    var messageField = document.getElementById("cf-message");
    var errorBox = document.getElementById("cf-error");
    var statusBox = document.getElementById("cf-status");
    var copyBtn = document.getElementById("copy-email");
    var fields = [nameField, emailField, messageField];

    contactForm.hidden = false;

    // Collapse line breaks so single-line fields cannot add extra lines to the email.
    var singleLine = function (value) {
      return value.replace(/[\r\n]+/g, " ").trim();
    };

    // Show one error and flag its field for assistive technology; showError(null) clears it.
    var showError = function (field, message) {
      fields.forEach(function (f) {
        f.removeAttribute("aria-invalid");
        f.removeAttribute("aria-describedby");
      });
      if (!field) {
        errorBox.hidden = true;
        errorBox.textContent = "";
        return;
      }
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", "cf-error");
      errorBox.textContent = message;
      errorBox.hidden = false;
      field.focus();
    };

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      statusBox.textContent = "";
      var name = singleLine(nameField.value);
      var email = singleLine(emailField.value);
      var message = messageField.value.trim();

      if (!name) return showError(nameField, "Please enter your name.");
      // Basic shape check only (text@domain.tld, no spaces); the email app does the rest.
      if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
        return showError(emailField, "Please enter a valid email address so I can reply.");
      }
      if (message.length < 10) {
        return showError(messageField, "Please tell me a little about your business (at least 10 characters).");
      }
      showError(null);

      // Build the mailto: link and hand it to the visitor's email app.
      var subject = "Website inquiry from " + name;
      var body = message + "\n\n" + name + "\n" + email;
      window.location.href =
        "mailto:" + toAddress +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      statusBox.textContent =
        "Your email app should open with the message ready to send. If nothing happens, use \"Copy email address\" and send it from any email program.";
    });

    // "Copy email address": uses the Clipboard API, with a hidden-input fallback
    // for older browsers or pages where the API is blocked.
    copyBtn.addEventListener("click", function () {
      var done = function () {
        statusBox.textContent = "Email address copied: " + toAddress;
      };
      var fallback = function () {
        var temp = document.createElement("input");
        temp.value = toAddress;
        temp.setAttribute("readonly", "");
        temp.style.position = "absolute";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        temp.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (e) {
          ok = false;
        }
        document.body.removeChild(temp);
        if (ok) {
          done();
        } else {
          statusBox.textContent = "Couldn't copy automatically. My email address is " + toAddress;
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(toAddress).then(done, fallback);
      } else {
        fallback();
      }
    });
  }

  /* ---------- Scroll progress bar ---------- */
  // A thin bar at the top of the page; CSS scales it using the --p variable (0 to 1).
  var bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  var ticking = false;
  // Set --p to how far down the page the visitor has scrolled (0 at top, 1 at bottom).
  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    bar.style.setProperty("--p", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener("resize", updateProgress); // page height changes with window size
  updateProgress();
})();
