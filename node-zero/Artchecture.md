graph TB
    subgraph "CLI Layer"
        CLI[CLI Entry Point]
        Commands[CLI Commands]
        Handlers[File Handlers]
        Utils[CLI Utilities]
    end
    
    subgraph "Core Library"
        Context[Context Management]
        Config[Configuration System]
        Encoding[Encoding System]
        Crypto[Cryptography]
        Error[Error Handling]
        Types[Type Definitions]
    end
    
    subgraph "Feature Modules"
        ZKP[Zero-Knowledge Proofs]
        ID[Identity Management]
        Key[Key Management]
        Parser[File Parser/Serializer]
        Stego[Steganography]
    end
    
    %% CLI Layer relations
    CLI --> Commands
    Commands --> Handlers
    Commands --> Utils
    
    %% Core integrations
    Commands --> Context
    Commands --> Config
    Commands --> Encoding
    Commands --> Crypto
    Commands --> Error
    
    %% Feature use
    Commands --> ZKP
    Commands --> ID
    Commands --> Key
    Commands --> Parser
    Commands --> Stego
    
    %% Core dependencies
    Context --> Config
    Encoding --> Crypto
    ZKP --> Crypto
    ID --> Crypto
    Key --> Crypto
    
    %% Feature interdependencies
    ID --> Key
    ZKP --> ID
    Parser --> ID
    Parser --> Key
    
    %% Config flows
    Config -. Environment Variables .-> env[Environment]
    Config -. User Configuration .-> files[Configuration Files]
    
    %% Legend
    classDef core fill:#f9f,stroke:#333,stroke-width:2px
    classDef cli fill:#bbf,stroke:#333,stroke-width:2px
    classDef feature fill:#bfb,stroke:#333,stroke-width:2px
    
    class Context,Config,Encoding,Crypto,Error,Types core
    class CLI,Commands,Handlers,Utils cli
    class ZKP,ID,Key,Parser,Stego feature