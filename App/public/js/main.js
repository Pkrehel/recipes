    var sortBy = '-1';
    var orderBy = 'createdAt';
    var limit = '3';
    var offset = '0'
$('#more-recent').on('click', function() {
    $.ajax({
      data: {
        sortBy: sortBy,
        orderBy: orderBy,
        limit: limit,
        offset: offset
      },
      url: "api/v1/recipes",
      contentType: 'application/json',
      success: changeDataParams,
  });
});

function changeDataParams(response){
  console.log(response);
  $("#recentRecipesSection").children(".recipe-card").fadeOut('slow', function(){
  $("#recentRecipesSection").children(".recipe-card").remove()
    
  });
  offset = parseInt(offset) + 1;
  offset = offset.toString();
  
}