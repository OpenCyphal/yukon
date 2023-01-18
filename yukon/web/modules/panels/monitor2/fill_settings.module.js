export function fillSettings(settings, yukon_state) {
    settings.VerticalLineMarginTop = 3;
    settings.PageMarginTop = 20;
    settings.NodeXOffset = 20;
    settings.DistancePerHorizontalConnection = yukon_state.all_settings["Monitor view"]["Distance per horizontal connection"];
    settings.DistanceBetweenNodes = 2;
    settings.NodeWidth = yukon_state.all_settings["Monitor view"]["Node width"];
    settings.AvatarMinHeight = 50;
    settings.AvatarConnectionPadding = 20;
    settings.LinkInfoWidth = yukon_state.all_settings["Monitor view"]["Link info width"];
    settings.PubLineXOffset = settings.NodeXOffset + settings.NodeWidth + settings.LinkInfoWidth + 20;
    settings.DistanceBetweenLines = yukon_state.all_settings["Monitor view"]["Distance between vertical lines"];
    settings.HorizontalColliderHeight = 17;
    settings.HorizontalColliderOffsetY = (settings.HorizontalColliderHeight - 1) / 2
    settings.HorizontalLabelOffsetY = 20;
    settings.HorizontalPortLabelOffsetY = 10;
    settings.HorizontalLineWidth = yukon_state.all_settings["Monitor view"]["Horizontal line width"];
    settings.VerticalLineWidth = yukon_state.all_settings["Monitor view"]["Vertical line width"];
    settings.LabelLeftMargin = 12;
    settings.VerticalColliderWidth = 9;
    settings.LinkLabelColor = "transparent";
    settings.LinkLabelTextColor = "black";
    settings.LinkLabelHighlightColor = "black";
    settings.LinkLabelHighlightTextColor = "white";
    settings.ServicePortLabelBgColor = "lightblue";
    settings.ServicePortLabelColor = "black";
    settings.PublisherPortLabelBgColor = "lightgreen";
    settings.PublisherPortLabelColor = "black";
    settings.SubscriberPortLabelBgColor = "pink";
    settings.SubscriberPortLabelColor = "black";
    settings.ServiceColor = "lightblue";
    settings.ServiceForegroundColor = "black";
    // Add random shades of orange to the list
    settings.HighlightColorsRaw = yukon_state.all_settings["Monitor view"]["Highlight colors"];
    settings.HighlightColors = [];
    settings.SubscriptionsOffset = null;
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
    // Use a for loop to generate the structure
    for (const color of settings.HighlightColorsRaw) {
        settings.HighlightColors.push({ color: color, taken: false });
    }
    settings.DefaultMessageCapacity = yukon_state.all_settings["Monitor view"]["Default saved subscription messages capacity"];
}