
// DATA.GOV API CONNECTION:
// $(function() {
//     $.ajax({
//       url: "https://55SYabUUoORJCAUl4xxIXqazV6lVs2g79Evqkncf@api.nal.usda.gov/fdc/v1/search",
//       contentType: 'application/json',
//       api_key: "55SYabUUoORJCAUl4xxIXqazV6lVs2g79Evqkncf",
//       generalSearchInput: "banana",
//       success: function(results){
//         console.log(results)
//       }
//   });
// });

$(".like-btn-homepage").click(function() {
    $.ajax({
      url: "/recipes/5d1c450b36077a09011b7215/love",
      method: "POST",
      contentType: 'application/json',
      success: function(response){
        console.log(response)
        console.log("LOVE BUTTON CLICKED")
      }
  });
});