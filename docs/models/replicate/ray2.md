## Basic model info

Model name: luma/ray-flash-2-720p
Model description: Generate 5s and 9s 720p videos, faster and cheaper than Ray 2


## Model inputs

- duration (optional): Duration of the video in seconds (integer)
- aspect_ratio (optional): Aspect ratio of the generated video (string)
- loop (optional): Whether the video should loop, with the last frame matching the first frame for smooth, continuous playback. (boolean)
- prompt (required): Text prompt for video generation (string)
- concepts (optional): List of camera concepts to apply to the video generation. Concepts include: truck_left, pan_right, pedestal_down, low_angle, pedestal_up, selfie, pan_left, roll_right, zoom_in, over_the_shoulder, orbit_right, orbit_left, static, tiny_planet, high_angle, bolt_cam, dolly_zoom, overhead, zoom_out, handheld, roll_left, pov, aerial_drone, push_in, crane_down, truck_right, tilt_down, elevator_doors, tilt_up, ground_level, pull_out, aerial, crane_up, eye_level (array)
- end_image (optional): An optional last frame of the video to use as the ending frame. (string)
- start_image (optional): An optional first frame of the video to use as the starting frame. (string)
- end_image_url (optional): Deprecated: Use end_image instead (string)
- start_image_url (optional): Deprecated: Use start_image instead (string)


## Model output schema

{
  "type": "string",
  "title": "Output",
  "format": "uri"
}

If the input or output schema includes a format of URI, it is referring to a file.


## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (https://replicate.com/p/f5nnc0aq65rmc0cnjgjbrv5ftc)

#### Input

```json
{
  "loop": false,
  "prompt": "A cinematic anime character intimate closeup, she is sitting at a cafe on a busy city street in the morning, it is cold",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

#### Output

```json
"https://replicate.delivery/xezq/xexTDQWeTTtwy0ghRl7YVWKSj4WYYzTBEbrP939Q6Qn8MbYUA/tmp_a397eyu.mp4"
```


### Example (https://replicate.com/p/12j1d9xejsrme0cnjgkbfea0mm)

#### Input

```json
{
  "loop": false,
  "prompt": "A snow leopard crouched on a rocky ledge, staring directly at camera, snowflakes falling around it",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

#### Output

```json
"https://replicate.delivery/xezq/M9an0UVPbhIfC6d8kTFC1Wb0gQcXY0VH2IHpsWfJprYVPbYUA/tmp63xpvaa6.mp4"
```


### Example (https://replicate.com/p/bgy8s1fg79rma0cnjgnt9psmhg)

#### Input

```json
{
  "loop": false,
  "prompt": "A polar bear swimming underwater",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

#### Output

```json
"https://replicate.delivery/xezq/ESnNsqooCLqnGZIe8zxsIE8TpHcZVrWC7xkIdDEWeWOtUbYUA/tmpvneiyc44.mp4"
```


## Model readme

> # Ray Flash 2
> 
> Ray 2 is a large-scale video generative model built on Luma's multi-modal architecture. The model demonstrates capabilities in generating realistic videos with coherent motion and detailed visuals based on text prompts.
> 
> ## Terms of use
> 
> https://lumalabs.ai/dream-machine/api/terms
> 
> ## Privacy
> 
> Data from this model is sent from Replicate to Luma.
> 
> https://lumalabs.ai/legal/privacy
> 
> ## Technical Overview
> 
> Ray 2 represents a 10x compute scale increase from its predecessor Ray 1. The architecture improvements focus on:
> 
> - Motion coherence across video frames
> - Detail preservation in generated content
> - Logical sequencing of events
> - Multi-modal input processing
> 
> ## Current Capabilities
> 
> ### Text-to-Video Generation
> 
> - Natural motion synthesis
> - Physics-based simulations
> - Photorealistic detail rendering
> - Cinematic scene composition
> - Human expression and movement
> - Surrealist concept visualization
> - Environmental exploration sequences
> - Visual effects generation
> - Macro/close-up detail rendering
> 
> ### Input/Output Specifications
> 
> Currently supports:
> 
> - Text-to-video generation
> 
> Planned features:
> 
> - Image-to-video conversion
> - Video-to-video transformation
> - Video editing capabilities
> 
> ## Technical Strengths
> 
> ### Motion Handling
> 
> - Coherent object and camera movement
> - Physical simulation (liquids, particles, natural phenomena)
> - Complex motion sequences
> - Dynamic camera techniques
> 
> ### Visual Quality
> 
> - High-fidelity detail rendering
> - Realistic lighting and shadows
> - Texture and material accuracy
> - Atmospheric effects
> 
> ### Scene Understanding
> 
> - Complex scene composition
> - Multi-object interaction
> - Environmental dynamics
> - Perspective and scale management
> 
> ### Specialized Capabilities
> 
> - Macro/micro scale rendering
> - Surrealist concept visualization
> - Physics-based simulations
> - Visual effects integration
> 
> ## Implementation Notes
> 
> The model demonstrates particular effectiveness in:
> 
> - Natural phenomena simulation
> - Character animation
> - Environmental dynamics
> - Complex motion sequences
> - Detail preservation in close-up shots
> - Cinematic scene composition
> 
> # Ray2 Example Prompts
> 
> ## Natural Motion
> 
> - Wide shot of a man in a fur coat running through the snow antarctic with many explosions around him
> - "An overhead shot follows a vintage car winding through autumn-painted mountain roads, its polished surface reflecting the fiery canopy above. Fallen leaves swirl in its wake while sunlight filters through branches, creating a dappled dance of light across the hood." (by Ashutosh Shrivastava)
> - "Fencing athletes fighting on the court" (by Artur Ziguratt)
> - Gorilla surfing on a wave
> - "A herd of wild horses galloping across a dusty desert plain under a blazing midday sun, their manes flying in the wind; filmed in a wide tracking shot with dynamic motion, warm natural lighting, and an epic." (by Guillermo Castellanos)
> - A humpback whale swimming through space particles
> - A sports car in the clouds in the sky
> - Detailed tank prompt about a Panzerkampfwagen Tiger Ausf. E crossing a river (by StevieMac03)
> - Avalanche
> - Insane camera flythrough of a turtle in an aquarium
> 
> ## Instruction Following
> 
> - "A snow leopard crouched on a rocky ledge, staring directly at camera, snowflakes falling around it." (by Ashutosh Shrivastava)
> - "Relaxed woman motor biker in a dark neutral background, natural look" (by Artur Ziguratt)
> - Two polar bears sun bathing on a floating iceberg, they both wear Hawaii shirts and sun glasses
> - A miniature baby cat is walking and exploring on the surface of a fingertip
> - Underwater sloth swimming sunny
> - Ship captain smokes a pipe, turns and looks at a looming storm in the distance
> - "A pair of hands skillfully slicing a perfectly cooked steak on a wooden cutting board, with faint steam rising from it" (by Melanie Petschke)
> - A menagerie of animals trapped in a block of ice
> - Closeup of fingertips sculpting clay
> - Cinematic shot of ballerina dancing on ice floe in icy ocean in arctic
> 
> ## Physics and Simulation
> 
> - A massive orb of water floating in a backlit forest
> - "A girl in a red velvet dress floating underwater" (by Artur Ziguratt)
> - An explosion with camera shake
> - Maple syrup pouring onto pancakes
> - A truck driving in the mexico jungle as it runs through puddles of water
> - Drinking a bottle of water
> - "A violinist performing on a rainy street at night, amber streetlights illuminating her and the violin, gentle rain falling around her and she is wet" (by Ashutosh Shrivastava)
> - Raindrops in extreme slow motion
> - Mukbang video of a man eating a sand castle
> - A campfire
> 
> ## Photorealism
> 
> - Seal Whiskers
> - A closeup of a paintbrush on a canvas
> - Dewdrops glistening on a spiderweb at sunrise
> - Closeup of sculpting clay
> - "A subway car arriving on an empty platform" (by Jerrod Lew)
> - "Close up of nail polish being applied" (by fAIkout)
> - A polar bear swimming underwater
> - Closeup of hot air balloon flame
> - A tarantula
> - An ultrasound
> 
> ## Cinematic Scenes
> 
> - A pirate ship in a raging sea
> - Artist in studio prompt (by Guillermo Castellanos)
> - Warrior at sunrise prompt (by Guillermo Castellanos)
> - An explosion with camera shake
> - "An African woman, fashion context, red hue backdrop" (by Artur Ziguratt)
> - "A burning stern viking ship, with a Viking on the water, against background at sea" (by Artur Ziguratt)
> - "Closeup on a man sitting in a dark car, 5 oclock shadow, blurry neon signs in the background, slight blur and chromatic aberration at the edges of the frame, lens flare" (by Andy Orsow)
> - Detective in dark alley prompt (by Guillermo Castellanos)
> - An underwater city
> - A 1940s detective navigating a shadowy alley with dramatic lighting
> 
> ## People and Expressions
> 
> - "A man plays saxophone" (by Artur Ziguratt)
> - "Young guy with huge headphones scrolling through his phone, gen-Z like" (by Artur Ziguratt)
> - "Two elegant older women sitting at an outdoor café" (by Artur Ziguratt)
> - Detailed cellist performance prompt (by Aymiee)
> - Grandma knitting a sweater
> - "A model blowing a kiss into the camera. Pastel tones" (by Melanie Petschke)
> - A woman filming a live video next to her ring light
> - A muscular male influencer working out in a bright modern gym
> - A cinematic character intimate closeup
> - Detailed neon woman portrait prompt (by Guillermo Castellanos)
> 
> ## Surrealism
> 
> - The singularity
> - An intimate closeup of an alien
> - Surreal forest scene prompt (by anu aakash)
> - Aliens at a fine dining restaurant
> - "Giant sea monster attacks ship" (by Stevie Mac)
> - Microscopic closeup of bacteria
> - Post-apocalyptic chihuahua prompt
> - A macro closeup of refracting water orb
> - An photorealistic anthropomorphic banana man doing taxes
> - AR computer projection prompt
> 
> ## World Exploration
> 
> - Insane camera flythrough mount everest
> - Insane camera flythrough a colorful realm
> - Insane camera flythrough futuristic city
> - Insane camera flying through asteroids
> - Insane camera flythrough an alien world
> - High speed camera shot flying through a slot in the grand canyon, chaotic during a flood
> - Rocket flying through asteroids
> - Insane motion shot of an astronaut flying through space
> - Supermarket fly through
> - FPV drone footage in a museum
> 
> ## Visual Effects
> 
> - 18mm wide angle action shot prompt
> - A planet exploding
> - Infrared footage of bigfoot
> - Watercolor oil bleeding on a canvas
> - The quantum realm
> - A squirrel eating an acorn, green screen background
> - Neural Connections
> - Cigar smoke
> - The multiverse
> - Long exposure shot of cars driving by
> 
> ## Closeup Details
> 
> - Macro closeup of raindrops on a leaf
> - Closeup of beer
> - Closeup of lips
> - Grating parmesan cheese
> - Closeup of flowing fabric
> - Closeup of a dog's nose sniffing
> - Macro closeup of snake skin
> - A snowglobe
> - Macro closeup of a bee pollinating
> - Intimate closeup of a samurais face in the rain
