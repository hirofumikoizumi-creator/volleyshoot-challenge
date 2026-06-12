# On-device Foot Recognition Pipeline

This folder implements the product constraint for Volley Shoot Challenge:

- Camera frames must never be sent off-device.
- No OpenAI, GCP, AWS, or paid cloud AI API is used for pose inference.
- Runtime inference cost is zero as user count grows.
- Pose inference target is BlazePose Lite TFLite because ankle, heel, and foot_index landmarks are required.

## Step Checks

### Step 1: Camera + Inference Pipeline

The native frame processor should feed BlazePose Lite output into:

```ts
buildPoseFrameFromBlazePose(output, transform);
```

Only these lower-body landmarks are extracted:

- hip
- knee
- ankle
- heel
- foot_index

### Step 2: Coordinate Transform + Debug Overlay

Use `modelToCoverViewPoint` for:

- model coordinates
- camera frame coordinates
- screen coordinates
- front-camera mirroring
- resizeMode cover crop compensation

Debug overlay should draw ankle, heel, and foot_index with Skia.

### Step 3: Landmark Post Processing

`FootPostProcessor` applies:

- One Euro Filter smoothing
- velocity from recent frames
- linear latency extrapolation
- visibility threshold filtering

### Step 4: Ball + Volley Judge

`judgeVolleyHit` requires all conditions:

- foot_index enters ball collision circle
- swing speed is above threshold
- landmark visibility is valid
- ball timing is within +/-150ms
