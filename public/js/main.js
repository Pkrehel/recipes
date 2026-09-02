/* Site-wide behaviors. Requires jQuery + Bootstrap 4 bundle (loaded in footer). */
(function ($) {
  "use strict";

  // Full-page pancake-flip animation while a recipe uploads.
  window.showLoadingAnimation = function () {
    var page = document.getElementById("fullPageHide");
    var cooking = document.getElementById("cooking-container");
    if (page) page.style.display = "none";
    if (cooking) cooking.style.display = "block";
  };

  $(function () {
    // Auto-dismiss flash alerts
    setTimeout(function () {
      $(".alert-container .alert").alert("close");
    }, 6000);

    // Keep the Browse mega menu open when clicking inside it
    $(".browse-menu").on("click", function (e) {
      e.stopPropagation();
    });

    // ---------- Recipe form ----------
    var form = $("#recipe-form");
    if (!form.length) return;

    // The browser only fires "submit" once built-in validation passes.
    form.on("submit", function () {
      window.showLoadingAnimation();
    });

    var labels = { 0: "Easy", 1: "Medium", 2: "Challenging" };
    var slider = $("#difficultySlider");
    var setLabel = function () {
      $("#rangeText").text(labels[slider.val()]);
    };
    setLabel();
    slider.on("input change", setLabel);

    $("#image").on("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert("That image is larger than 8 MB. Please choose a smaller file.");
        this.value = "";
        return;
      }
      $(this).next(".custom-file-label").text(file.name);
      var reader = new FileReader();
      reader.onload = function (e) {
        $("#imagePreview").attr("src", e.target.result).removeClass("d-none");
      };
      reader.readAsDataURL(file);
    });

    function repeatable(wrapSel, addSel, name, placeholder) {
      var wrap = $(wrapSel);
      var max = 100;
      $(addSel).on("click", function (e) {
        e.preventDefault();
        if (wrap.find("input").length >= max) return;
        var row = $(
          '<div class="repeat-row">' +
            '<input class="form-control" type="text" name="' + name + '[]" placeholder="' + placeholder + '" maxlength="500">' +
            '<button class="btn btn-ghost btn-sm remove_field" type="button" aria-label="Remove"><i class="fas fa-times" aria-hidden="true"></i></button>' +
            "</div>"
        );
        $(addSel).before(row);
        row.find("input").trigger("focus");
      });
      wrap.on("click", ".remove_field", function (e) {
        e.preventDefault();
        if (wrap.find("input").length > 1) $(this).closest(".repeat-row").remove();
        else $(this).closest(".repeat-row").find("input").val("");
      });
      wrap.on("keydown", "input", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          $(addSel).trigger("click");
        }
      });
    }
    repeatable(".ingredients_input_fields_wrap", ".ingredients_add_field_button", "ingredients", "e.g. 2 cups all-purpose flour");
    repeatable(".directions_input_fields_wrap", ".directions_add_field_button", "directions", "Describe this step");

    var recalc = function () {
      var total = (parseInt($("#prepTime").val(), 10) || 0) + (parseInt($("#cookTime").val(), 10) || 0);
      $("#totalTimeText").text(total + " minutes");
    };
    $("#prepTime, #cookTime").on("input change", recalc);
    recalc();

    $("#summary")
      .on("input", function () {
        $("#summaryCount").text(this.value.length);
      })
      .trigger("input");
  });
})(window.jQuery);
