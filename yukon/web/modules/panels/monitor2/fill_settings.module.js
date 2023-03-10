export function fillSettings(settings, yukon_state) {
    // This layer of indirection is not actually compulsory and settings can be directly accessed from yukon_state.all_settings, missing settings and error handling can be done here, however
    settings.VerticalLineMarginTop = 3;
    settings.PageMarginTop = 5;
    settings.NodeXOffset = 5;
    settings.DistancePerHorizontalConnection = yukon_state.all_settings["Monitor view"]["Distance per horizontal connection"];
    settings.DistanceBetweenNodes = 5;
    settings.NodeWidth = yukon_state.all_settings["Monitor view"]["Node width"];
    settings.AvatarMinHeight = 350;
    settings.EmptyPortsDistanceAboveUnassignedPorts = 8;
    settings.AvatarConnectionPadding = 10;
    settings.HorizontalLineYOffset = 10
    settings.LinkInfoWidth = yukon_state.all_settings["Monitor view"]["Link info width"];
    settings.PubLineXOffset = settings.NodeXOffset + settings.NodeWidth + settings.LinkInfoWidth + 20;
    settings.DistanceBetweenLines = yukon_state.all_settings["Monitor view"]["Distance between vertical lines"];
    settings.HorizontalColliderHeight = 17;
    settings.HorizontalColliderOffsetY = (settings.HorizontalColliderHeight - 1) / 2
    settings.HorizontalLabelOffsetY = 20; // The label that is above the line
    settings.HorizontalPortLabelOffsetY = 6; // Offset of the lines compared to port label (left side) texts
    settings.HorizontalLineWidth = yukon_state.all_settings["Monitor view"]["Horizontal line width"];
    settings.VerticalLineWidth = yukon_state.all_settings["Monitor view"]["Vertical line width"];
    settings.LabelLeftMargin = 12;
    settings.VerticalColliderWidth = 9;
    settings.LinkLabelColor = "transparent";
    settings.LinkLabelTextColor = "black";
    settings.LinkLabelHighlightColor = "black";
    settings.LinkLabelHighlightTextColor = "white";
    settings.ServicePortLabelBgColor = yukon_state.all_settings["Monitor view"]["Colors"]["Service color"];
    settings.ServicePortLabelColor = yukon_state.all_settings["Monitor view"]["Colors"]["Service text color"];
    settings.PublisherPortLabelBgColor = yukon_state.all_settings["Monitor view"]["Colors"]["Publisher color"];
    settings.PublisherPortLabelColor = yukon_state.all_settings["Monitor view"]["Colors"]["Publisher text color"];
    settings.SubscriberPortLabelBgColor = yukon_state.all_settings["Monitor view"]["Colors"]["Subscriber color"];
    settings.SubscriberPortLabelColor = yukon_state.all_settings["Monitor view"]["Colors"]["Subscriber text color"];
    settings.ServiceColor = "darkblue";
    settings.ServiceForegroundColor = "black";
    // Add random shades of orange to the list
    settings.HighlightColorsRaw = yukon_state.all_settings["Monitor view"]["Highlight colors"];
    settings.HighlightColors = [];
    settings.SubscriptionsOffset = null;
    settings.PublishersOffset = null;
    settings.SubscriptionsVerticalOffset = settings.PageMarginTop;
    settings.SubscriptionsVerticalSpacing = 20;
    settings.ShowLinkNameOnSeparateLine = yukon_state.all_settings["Monitor view"]["Show link name on another line"]
    if (settings.ShowLinkNameOnSeparateLine) {
        settings.DistancePerHorizontalConnection = settings.DistancePerHorizontalConnection * 2;
        settings.LinkNameOffset = -3;
        if (yukon_state.all_settings["Monitor view"]["Show name above datatype"]) {
            settings.ShowNameAboveDatatype = true;
        }
    }
    settings.BlinkSubscriptionOption = yukon_state.all_settings["Monitor view"]["Subscriptions"]["Blink mode"]["chosen_value"]
    settings.ShowStreamToPlotJugglerOption = yukon_state.all_settings["Monitor view"]["Subscriptions"]["Show Stream to PlotJuggler option"]
    settings.ShowLogToConsoleOption = yukon_state.all_settings["Monitor view"]["Subscriptions"]["Show log to console option"]
    settings.DefaultFetchDelay = yukon_state.all_settings["Monitor view"]["Subscriptions"]["Default fetch delay (ms)"]
    // Use a for loop to generate the structure
    let counter = 0;
    for (const color of settings.HighlightColorsRaw) {
        if (counter == 0) {
            counter += 1;
            continue;
        }
        if (counter % 2 == 1) {
            counter += 1;
            continue;
        }
        settings.HighlightColors.push({ color: color, taken: false });
        counter += 1;
    }
    settings.DefaultMessageCapacity = yukon_state.all_settings["Monitor view"]["Default saved subscription messages capacity"];
}