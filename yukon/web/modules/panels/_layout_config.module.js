export const layout_config = {
    settings:{
        hasHeaders: true,
    },
    dimensions: {
        borderWidth: 3,
        minItemHeight: 10,
        minItemWidth: 10,
        headerHeight: 19,
        dragProxyWidth: 300,
        dragProxyHeight: 200
    },
    content: [
        {
            type: 'row',
            content: [
                {
                    type: "column",
                    content: [
                        {
                            type: 'row',
                            content: [
                                {
                                    type: 'stack',
                                    content: [
                                        {
                                            type: 'component',
                                            componentName: 'monitor2Component',
                                            isClosable: true,
                                            title: 'Monitor',
                                        },
                                        {
                                            type: 'component',
                                            componentName: 'registersComponent',
                                            isClosable: true,
                                            title: 'Registers',
                                        },
                                        {
                                            type: 'component',
                                            componentName: 'settingsComponent',
                                            isClosable: true,
                                            title: 'Settings',
                                        },
                                        {
                                            type: "component",
                                            componentName: "dronecanComponent",
                                            isClosable: true,
                                            title: "DroneCAN",
                                        }
                                    ]
                                },
                            ]
                        },
                        {
                            type: "stack",
                            content: [
                                {
                                    type: 'component',
                                    componentName: 'messagesComponent',
                                    isClosable: true,
                                    doesRequireSettingsButton: true,
                                    title: 'Messages',
                                },
                                {
                                    type: 'component',
                                    height: 15,
                                    componentName: 'statusComponent',
                                    isClosable: true,
                                    title: 'Status',
                                }
                            ],
                            height: 15,
                        }
                    ]
                },
                {
                    type: 'column',
                    width: 20,
                    content: [
                        {
                            type: 'stack',
                            activeItemIndex: 0,
                            content: [
                                {
                                    type: "component",
                                    componentName: "transportsComponent",
                                    isClosable: true,
                                    title: "Transports",
                                },
                                {
                                    type: "component",
                                    componentName: "registerUpdateLogComponent",
                                    isClosable: true,
                                    title: "Register logs",
                                }
                            ]
                        },
                        {
                            type: "component",
                            componentName: "transportsListComponent",
                            isClosable: true,
                            title: "Transports list",
                            height: 30,
                        },
                    ]
                }
            ]
        }
    ]
};