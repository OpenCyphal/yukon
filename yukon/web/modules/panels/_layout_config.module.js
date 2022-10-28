export const layout_config = {
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
                                            componentName: 'monitorComponent',
                                            isClosable: true,
                                            title: 'Monitor',
                                        },
                                        {
                                            type: 'component',
                                            componentName: 'registersComponent',
                                            isClosable: true,
                                            title: 'Registers',
                                        },
                                    ]
                                },
                                {
                                    type: 'component',
                                    componentName: 'subsComponent',
                                    isClosable: true,
                                    title: 'Subs',
                                    width: 30,
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
                    width: 30,
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
                                    componentName: "commandsComponent",
                                    isClosable: true,
                                    title: "Commands",
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
                        },
                    ]
                }
            ]
        }
    ]
};