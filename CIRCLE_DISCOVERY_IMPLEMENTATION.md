# Circle Discovery and Joining Implementation

This document shows the key code pieces for circle discovery and joining functionality.

## Backend: Circle Discovery Service

### Key File: `server/src/services/circle.service.ts`

**Main Method - Discover Circles:**
```typescript
async discoverCircles(appVk?: string): Promise<CircleInfo[]> {
    const vk = appVk || await this.getAppVk();
    
    // Query unspent outputs from Bitcoin
    const { stdout } = await execAsync(
        "bitcoin-cli listunspent 0 9999999 '[]' true",
        { maxBuffer: 10 * 1024 * 1024 }
    );

    const utxos = JSON.parse(stdout);
    const circles: CircleInfo[] = [];

    // Scan each UTXO for charm app data
    for (const utxo of utxos) {
        const txInfo = await this.getTransactionWithCharmData(utxo.txid, utxo.vout);
        if (txInfo) {
            const circleInfo = await this.parseCircleState(
                `${utxo.txid}:${utxo.vout}`,
                txInfo
            );
            if (circleInfo && !circleInfo.isComplete) {
                circles.push(circleInfo);
            }
        }
    }

    return circles;
}
```

**Parse CircleState from CBOR:**
```typescript
private async parseCircleState(
    utxo: string,
    output: any
): Promise<CircleInfo | null> {
    // Extract charm data from output
    const charmDataHex = this.extractCharmData(output);
    if (!charmDataHex) return null;

    // Decode CBOR
    const charmDataBuffer = Buffer.from(charmDataHex, "hex");
    const decoded = cbor.decode(charmDataBuffer);
    const state = decoded as CircleStateData;
    
    return {
        utxo,
        circleId: Buffer.from(state.circle_id).toString("hex"),
        memberCount: state.members.length,
        totalRounds: state.total_rounds,
        currentRound: state.current_round,
        contributionPerRound: state.contribution_per_round,
        // ... other fields
    };
}
```

### API Endpoint: `server/src/routes/circle.routes.ts`

```typescript
// GET /api/circles - Discover all active circles
router.get("/", circleController.discoverCircles.bind(circleController));

// GET /api/circles/:utxo - Get specific circle
router.get("/:utxo", circleController.getCircle.bind(circleController));
```

## Frontend: Circle Display Components

### Key File: `frontend/src/components/CircleCard.tsx`

**Circle Card Component:**
```typescript
export const CircleCard: React.FC<CircleCardProps> = ({
    circle,
    onJoin,
    isJoining = false,
    canJoin,
}) => {
    const progress = (circle.memberCount / circle.totalRounds) * 100;
    const isFull = circle.memberCount >= circle.totalRounds;

    return (
        <div className="bg-indigo-deep rounded-lg border border-cyan-accent/20 p-6">
            {/* Circle info display */}
            <h3>Circle #{circle.circleId.slice(0, 8)}...</h3>
            
            {/* Members progress bar */}
            <div className="w-full bg-midnight rounded-full h-2">
                <div
                    className="bg-cyan-accent h-2 rounded-full"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Contribution amount */}
            <div>{formatContribution(circle.contributionPerRound)}</div>

            {/* Join button */}
            {canJoin && !isFull && (
                <button onClick={() => onJoin(circle)}>
                    Join Circle
                </button>
            )}
        </div>
    );
};
```

### Key File: `frontend/src/components/CircleGrid.tsx`

**Main Grid Component:**
```typescript
export const CircleGrid: React.FC = () => {
    const [circles, setCircles] = useState<CircleInfo[]>([]);
    const [selectedCircle, setSelectedCircle] = useState<CircleInfo | null>(null);

    const loadCircles = async () => {
        const discoveredCircles = await circleService.discoverCircles();
        setCircles(discoveredCircles);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {circles.map((circle) => (
                <CircleCard
                    key={circle.utxo}
                    circle={circle}
                    onJoin={handleJoin}
                    canJoin={isConnected}
                />
            ))}
        </div>
    );
};
```

## Join Circle Flow

### Key File: `frontend/src/components/JoinCircleModal.tsx`

**Join Flow Implementation:**
```typescript
const handleJoin = async () => {
    setStep("preparing");
    
    // 1. Prepare join parameters
    const params: JoinCircleParams = {
        circle,
        newMemberPubkey: userPubkey,
        payoutRound,
        circleAddress: "",
        fundingUtxo: "",
        fundingUtxoValue: circle.contributionPerRound + 1000,
        changeAddress: address,
    };

    // 2. Build spell and generate PSBT
    const { psbt } = await joinService.prepareJoinCircle(params);

    // 3. Sign PSBT
    setStep("signing");
    const signedPsbt = await signPSBT(psbt, { autoFinalized: false });

    // 4. Broadcast transaction
    setStep("broadcasting");
    const transactionId = await pushPSBT(signedPsbt);

    setStep("success");
    onJoinComplete(); // Refresh circles list
};
```

### Key File: `frontend/src/services/JoinCircleService.ts`

**Prepare Join Transaction:**
```typescript
async prepareJoinCircle(params: JoinCircleParams): Promise<JoinCircleResult> {
    // Get previous transaction
    const prevTxs = await this.getPreviousTransaction(params.circle.utxo);
    
    // Build spell parameters
    const spellParams = {
        app_id: await this.calculateAppId(params.circle.utxo),
        app_vk: await this.getAppVk(),
        circle_utxo: params.circle.utxo,
        new_member_pubkey_hex: params.newMemberPubkey,
        payout_round: params.payoutRound.toString(),
        // ... other parameters
    };

    // Call backend to build and prove spell
    const response = await fetch(`${API_BASE_URL}/api/spells/build-and-prove`, {
        method: "POST",
        body: JSON.stringify({
            templateName: "join-circle",
            parameters: spellParams,
            fundingUtxo: params.fundingUtxo,
            fundingUtxoValue: params.fundingUtxoValue,
            changeAddress: params.changeAddress,
        }),
    });

    const data = await response.json();
    return {
        psbt: data.data.proveResult.psbt,
        spellYaml: data.data.spellYaml,
    };
}
```

## API Integration

### Frontend Service: `frontend/src/services/CircleService.ts`

```typescript
async discoverCircles(appVk?: string): Promise<CircleInfo[]> {
    const url = new URL(`${API_BASE_URL}/api/circles`);
    if (appVk) url.searchParams.set("appVk", appVk);

    const response = await fetch(url.toString());
    const data: DiscoverCirclesResponse = await response.json();
    return data.data.circles;
}
```

## Notes

1. **Circle Discovery**: The backend queries Bitcoin for UTXOs and parses charm data. In production, you'd want to use a Bitcoin indexer API (like Esplora/Blockstream) for better performance.

2. **CBOR Parsing**: CircleState is stored as CBOR-encoded data in charm outputs. The `parseCircleState` method decodes this.

3. **Join Flow**: 
   - User selects circle and payout round
   - Frontend calls backend to build join spell
   - Backend generates unsigned PSBT
   - Frontend signs PSBT with wallet
   - Frontend broadcasts signed transaction
   - UI updates when confirmed

4. **Error Handling**: All steps include proper error handling and user feedback.

5. **State Management**: Uses React hooks for local state. Consider adding React Query or similar for better caching and synchronization.

