/* Site-wide behaviors. Requires jQuery + Bootstrap 4 bundle (loaded in footer). */
(function ($) {
  "use strict";

  // Full-page "flipping pancake" animation while a recipe uploads.
  window.showLoadingAnimation = function () {
    var page = document.getElementById("fullPageHide");
    var cooking = document.getElementById("cooking-container");
    if (page) page.style.display = "none";
    if (cooking) cooking.style.display = "block";
  };

  $(function () {
    // Sign up / login toggle inside the slide-out panel
    $(".accountToggleButton").on("click keypress", function (e) {
      if (e.type === "keypress" && e.key !== "Enter" && e.key !== " ") return;
      $(".accountToggleContainer").toggle();
    });

    $('[data-toggle="tooltip"]').tooltip();

    // Auto-dismiss flash alerts
    setTimeout(function () {
      $(".alert-container .alert").alert("close");
    }, 6000);

    // ---------- Recipe form ----------
    var form = $("#recipe-form");
    if (!form.length) return;

    // The browser only fires "submit" once built-in validation passes.
    form.on("submit", function () {
      window.showLoadingAnimation();
    });

    // Difficulty slider label
    var labels = { 0: "Easy", 1: "Medium", 2: "Challenging" };
    var slider = $("#difficultySlider");
    var setLabel = function () {
      $("#rangeText").text(labels[slider.val()]);
    };
    setLabel();
    slider.on("input change", setLabel);

    // Image preview
    $("#image").on("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert("That image is larger than 8 MB. Please choose a smaller file.");
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        $("#imagePreview").attr("src", e.target.result).removeClass("d-none");
      };
      reader.readAsDataURL(file);
    });

    // Repeatable ingredient / direction rows
    function repeatable(wrapSel, addSel, name, placeholder) {
      var wrap = $(wrapSel);
      var max = 100;
      $(addSel).on("click", function (e) {
        e.preventDefault();
        if (wrap.find("input").length >= max) return;
        var row = $(
          '<div class="input-group mb-2">' +
            '<input class="form-control" type="text" name="' + name + '[]" placeholder="' + placeholder + '" maxlength="500">' +
            '<div class="input-group-append"><button class="btn btn-outline-danger btn-sm remove_field" type="button" aria-label="Remove"><i class="fas fa-trash-alt" aria-hidden="true"></i></button></div>' +
            "</div>"
        );
        $(addSel).before(row);
        row.find("input").trigger("focus");
      });
      wrap.on("click", ".remove_field", function (e) {
        e.preventDefault();
        if (wrap.find("input").length > 1) $(this).closest(".input-group").remove();
      });
      // Enter in a row adds a new row instead of submitting the form
      wrap.on("keydown", "input", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          $(addSel).trigger("click");
        }
      });
    }
    repeatable(".ingredients_input_fields_wrap", ".ingredients_add_field_button", "ingredients", "e.g. 2 cups all-purpose flour");
    repeatable(".directions_input_fields_wrap", ".directions_add_field_button", "directions", "Describe this step");

    // Live total time
    var recalc = function () {
      var total = (parseInt($("#prepTime").val(), 10) || 0) + (parseInt($("#cookTime").val(), 10) || 0);
      $("#totalTimeText").text(total + " minutes");
    };
    $("#prepTime, #cookTime").on("input change", recalc);
    recalc();

    // Summary character counter
    $("#summary").on("input", function () {
      $("#summaryCount").text(this.value.length);
    }).trigger("input");
  });
})(window.jQuery);
