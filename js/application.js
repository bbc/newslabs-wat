
var juicer = {
    apikey: '9OHbOpZpVh9tQZBDjwTlTmsCF2Ce0yGQ',
    host: "http://data.test.bbc.co.uk/bbcrd-juicer"
};

var defaultJuicerSources = [1, 3, 8, 10, 11, 12, 14, 22, 23, 24, 40, 41, 42, 43, 44, 45, 70, 71, 72, 85, 89, 160, 166];
var maxGraphYAxis = 10;
var graphs = [];

$(function() {

  // Get latest sources available from the juicer
  populateJuicerSources();
  
  $(document).on("touch click", '.sources-toggle', function(event) {
    $('#sources').toggle();
    $('.sources-toggle').toggleClass('active');
  });
  
  $(document).on("touch click", '#sources-hide', function(event) {
    $('#sources').hide();
    $('.sources-toggle').removeClass('active');
  });
  
  $(document).on("touch click", '#examples a', function(event) {
    event.preventDefault();
    $('form[name="search"] input[name="keywords"]').val( $(this).text() );
    $('form[name="search"]').submit();
  });

  $(document).on("keyup", 'form[name="search"] input[name="keywords"]', function(event) {
    if ($(this).val() == "")
     $('#examples').show();
  });
  
  $('*[data-datepicker="true"] input[type="text"]').datepicker({
      todayBtn: true,
      orientation: "top left",
      autoclose: true,
      todayHighlight: true,
      format: 'yyyy-mm-dd',
  });

  $(document).on('touch click', '*[data-datepicker="true"] .input-group-addon', function() {
      $('input[type="text"]', $(this).parent()).focus();
  });

  $(document).on('touch click', '#sources-select-all', function() {
    $('input[type="checkbox"].source').prop('checked', 'checked');
  });

  $(document).on('touch click', '#sources-select-defaults', function() {
    $('input[type="checkbox"].source').prop('checked', '');
    $(defaultJuicerSources).each(function(index, value) {
    $('input[value="'+value+'"].source').prop('checked', 'checked');
    });
  });
  
  
  $(document).on("submit", 'form[name="search"]', function(event) {

    var form = this;
    
    event.preventDefault();

    $('button[type="submit"]', form).attr('disabled', 'disabled');
    
    $('#sources').hide();
    $('.sources-toggle').removeClass('active');
    $('#examples').hide();
    $("#results").html('');
    
    // @todo Reset and show progress bar
    $("#progress .progress-bar span").html("0% Complete");
    $("#progress .progress-bar").attr("aria-valuenow", "0");
    $("#progress .progress-bar").css({ width: "0%"});
    $("#progress").show();

    maxGraphYAxis = 10;
    graphs = [];
    
    // @todo Get optional start and end dates to bound query
    var startDate = "",
        endDate = "";

    if ( $('input[name="start"]').val() != "" )
      startDate = $('input[name="start"]', this).val()+'T00:00:00.000Z';
    
    if ( $('input[name="end"]').val() != "" )
      endDate = $('input[name="end"]', this).val()+'T00:00:00.000Z';

    // @todo Get selected sources
    var sources = [];
    var results = [];
    var responseCounter = 0;
  
    $('input[type="checkbox"].source:checked').each(function() {
        sources.push( { id: $(this).val(), name: $(this).data('name') } );
    });
    
    /*
    window.location.href = window.location.href.replace(/\#(.*)$/, '')
                          + "#sources="+encodeURIComponent(sources.join(','))
                          + "&keywords="+encodeURIComponent($('input[name="keywords"]', this).val());
    */
    
    $(sources).each(function(index, source) {
      var url = juicer.host+"/articles?sources[]="+source.id+"&q="+encodeURIComponent($('input[name="keywords"]', form).val())+"&published_before="+endDate+"&published_after="+startDate+"&apikey="+juicer.apikey;
      $.ajax({
        url: url,
        type: "GET",
        dataType: 'json',
        cache: false, // Append timestamp
        success: function(response) {
          results.push(response);
          addResult({ source: source, start: startDate, end: endDate }, response);
        },
        error: function() {
          // @todo Handle errors
        },
        complete: function() {
          responseCounter++;
          
          // For each result update progress, where sources.length == 100%
          var percentComplete = (responseCounter / sources.length) * 100;
          $("#progress .progress-bar span").html(percentComplete+"% Complete");
          $("#progress .progress-bar").attr("aria-valuenow", percentComplete);
          $("#progress .progress-bar").css({ width: percentComplete+"%"});

          $(graphs).each(function(index, graph) {
            var axes = graph.getAxes();
            axes.yaxis.options.max = maxGraphYAxis;
            graph.setupGrid();
            graph.draw();
          });

          if (responseCounter === sources.length) {
            $("#progress").slideUp();
            $('button[type="submit"]', form).removeAttr('disabled');
          }
        }
      });
    });

    return false;
  });
  
});

function populateJuicerSources() {
  $("#juicer-loading").slideDown();
  var juicerSources = $("#juicer-sources");
  juicerSources.html('<br/><p class="lead text-center">Updating sources...</p>')
  $.ajax({
    url: juicer.host+"/sources?apikey="+juicer.apikey,
    type: "GET",
    dataType: 'json',
    cache: false, // Append timestamp
    success: function(response) {
      juicerSources.html('');
      var sourcesInJuicer = response;
      $(sourcesInJuicer).each(function(index, source) {
        var checked = '';
        if (defaultJuicerSources.indexOf(source.id) > -1)
          checked = 'checked="checked"';
        
        var html = '<div class="col-md-3 checkbox" style="margin-top: 0;">'
                  +'  <label><input type="checkbox" '+checked+' class="source" name="source-'+source.id+'" data-name="'+source.name+'" value="'+source.id+'"/> <span class="text-muted">'+source.id+'.</span> '+source.name+'</label>'
                  +'</div>';
        juicerSources.append(html);
        
        $("#juicer-loading").hide();
        $('form[name="search"]').slideDown();
        $('#examples').show();
      });
    },
    error: function() {
    }
  });
};

function addResult(query, result) {

  if (result.total < 1)
    return;
  
  // Get all tags and put them in a single object so they can be easily sorted  
  var tags = [];
  $(result.aggregations.items).each(function(index, tagGroup) {
      $(tagGroup.items).each(function(index, tag) {
        tags.push({
          id: tag.id,
          name: decodeURIComponent(tag.id.replace(/^(.*)\//, '').replace(/_/g, ' ')),
          type: tagGroup.id,
          count: tag.count
        });
      });
  });
  // Reverse sort list of tags by the number of times it occurs (highest first)
  tags.sort(function(a,b) { return b.count - a.count; } );

  // Reformat time series so it can be easily plotted with flot
  var timeseries = [];
  $(result.timeseries).each(function(index, object) {
    timeseries.push([object.key, object.doc_count]);
    if (object.doc_count > maxGraphYAxis)
      maxGraphYAxis = object.doc_count;
  });
  
  // Pad timeseries array to a consistent start and end date (if dates specified)
  if (query.start != "") {
    var start = new Date(query.start).getTime();
    if (timeseries[0] && timeseries[0][0] != start)
      timeseries.unshift([start,0]);
  }
  if (query.end != "") {
    var end = new Date(query.end).getTime();
    if (timeseries[0] && timeseries[timeseries.length - 1][0] != end)
      timeseries.push([end,0]);
  }

  var html ='<div class="result col-sm-6 col-md-4 col-lg-3 sort" data-sort="'+result.total+'">'
          +'  <div class="panel panel-default">'
          +'    <div class="panel-heading clearfix">'
          +'      <h4 class="pull-left" style="margin: 5px 0;">'
          +'        <i class="fa fa-fw fa-newspaper-o"></i>'
          +'        '+query.source.name
          +'      </h4>'
          +'      <p style="position: absolute; top: 10px; right: 25px; margin: 0;" class="lead"><span class="badge" style="font-size: 16px;">'+result.total+' articles</span></p>'
          +'    </div>'
          +'    <div class="panel-body"  style="overflow: hidden;">'
          +'      <div id="graph-'+query.source.id+'" class="graph text-center" style="height: 200px;"></div>'
          +'    </div>'
          +'    <div class="panel-footer" style="overflow: hidden;">'
          +'      <p class="lead" style="margin-bottom: 0;">';
        
    // Show the top 5 tags that co-occur with the search term
    $(tags).each(function(index, tag) {
      if (index > 4)
        return;
      
      html += '        <span class="label label-info"><i class="fa fa-fw fa-tag"></i> '+tag.name+' <span class="badge" style="background-color: rgba(0,0,0,0.25);">'+tag.count+'</span></span><br/>';
    });
      
  html   +='      </p>'
          +'    </div>'
          +'  </div>'
          +'</div>';
      
  $("#results").append(html);

  // Draw graph
  var graph = $.plot("#graph-"+query.source.id, [timeseries], {
    shadowSize: 0,
    colors: ["#CA0914"],
    grid: { borderWidth: 0 },
    xaxis: { mode: "time",
             tickLength: 0,
             timeformat: "%d<br>%b",
             minTickSize: [5, 'day'], 
     },
     yaxis: { tickLength: 0,
              tickDecimals: 0,
              minTickSize: 1
     },
     bars: {
       show: true,
       lineWidth: 3
     }
  });
  
  graphs.push(graph);
  
  // Sort view on insert
  var wrapper = $('#results');
  wrapper.find('div.sort').sort(function (a, b) {
    return $(b).attr('data-sort') - $(a).attr('data-sort');
  })
  .appendTo( wrapper );

}