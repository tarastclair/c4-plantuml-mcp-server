# Example C4 Context Diagram Conversation Flow

## Initial Conversation

**User**: I need to create a C4 Context diagram for our new e-commerce system.

**Assistant**: I'll help guide you through creating a C4 Context diagram. Let's start with the core system.
What's the name of the system we're documenting?

**User**: It's called "ShopSmart E-commerce Platform"

**Assistant**: Great! I'll create the initial system.

[Tool Execution: add-system]
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

System(shopSmart, "ShopSmart E-commerce Platform", "Core e-commerce system handling product management, orders, and customer data")
@enduml
```

Now, let's identify who uses this system. Who are the main types of users or actors that interact with ShopSmart?

**User**: We have customers who shop on the platform, and store administrators who manage products and orders.

**Assistant**: I'll add both user types to the diagram.

[Tool Execution: add-person (x2)]
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(customer, "Customer", "A registered customer who shops on the platform")
Person(admin, "Store Administrator", "Staff member who manages products and orders")

System(shopSmart, "ShopSmart E-commerce Platform", "Core e-commerce system handling product management, orders, and customer data")

Rel(customer, shopSmart, "Browses products, places orders")
Rel(admin, shopSmart, "Manages inventory, processes orders")
@enduml
```

Great! Now, what external systems does ShopSmart interact with? Think about:
- Payment processing
- Shipping/delivery services
- External APIs
- Third-party integrations

**User**: We use Stripe for payments and a third-party shipping API for delivery tracking.

**Assistant**: I'll add those external systems and their relationships.

[Tool Execution: add-external-system (x2)]
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(customer, "Customer", "A registered customer who shops on the platform")
Person(admin, "Store Administrator", "Staff member who manages products and orders")

System(shopSmart, "ShopSmart E-commerce Platform", "Core e-commerce system handling product management, orders, and customer data")

System_Ext(stripe, "Stripe", "Payment processing system")
System_Ext(shipping, "Shipping API", "Third-party shipping and tracking system")

Rel(customer, shopSmart, "Browses products, places orders")
Rel(admin, shopSmart, "Manages inventory, processes orders")
Rel(shopSmart, stripe, "Processes payments")
Rel(shopSmart, shipping, "Tracks deliveries")
@enduml
```

The context diagram is taking shape! Let me ask a few verification questions:
1. Are there any other external systems we should include?
2. Should we add more detail to any of the relationships?
3. Would you like to make any adjustments to the layout?

**User**: The relationships could be clearer - Stripe should show it's using "HTTPS/REST" and the shipping API is actually specifically FedEx's API.

**Assistant**: I'll update those details to be more specific.

[Tool Execution: update-relationships, update-system]
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(customer, "Customer", "A registered customer who shops on the platform")
Person(admin, "Store Administrator", "Staff member who manages products and orders")

System(shopSmart, "ShopSmart E-commerce Platform", "Core e-commerce system handling product management, orders, and customer data")

System_Ext(stripe, "Stripe Payment API", "Payment processing system")
System_Ext(fedex, "FedEx Shipping API", "Package tracking and shipping rates")

Rel(customer, shopSmart, "Browses products, places orders")
Rel(admin, shopSmart, "Manages inventory, processes orders")
Rel(shopSmart, stripe, "Processes payments using", "HTTPS/REST")
Rel(shopSmart, fedex, "Retrieves shipping rates and tracking using", "HTTPS/REST")
@enduml
```

The diagram is now complete and provides a clear context view of the ShopSmart system. You can:
1. Generate a new SVG at any time
2. Make manual updates to any element
3. Add new elements or relationships

Would you like to make any other changes?

## Key Benefits Demonstrated

1. **Progressive Building**: The diagram builds up naturally through conversation
2. **Guided Discovery**: Questions help users think through all system interactions
3. **Easy Refinement**: Simple to update details and relationships
4. **Immediate Visualization**: See changes rendered after each step
5. **Flexible Control**: Can switch between guided and manual modes