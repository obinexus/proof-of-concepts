#include <SDL2/SDL.h>
#include <math.h>
#include <stdbool.h>
#include <windows.h>

#define SCREEN_WIDTH 800
#define SCREEN_HEIGHT 600
#define GRID_WIDTH 50
#define GRID_HEIGHT 30
#define PARTICLE_SPACING 15

// Function pointer types for physics laws
typedef void (*ForceFunction)(void* particle, float dt);
typedef float (*EnergyFunction)(void* particle, void** neighbors, int num_neighbors);
typedef void (*ConstraintFunction)(void* particle1, void* particle2, float rest_length);

// Material properties with function pointers
typedef struct {
    float elasticity;
    float mass;
    float stiffness;
    float damping;
    float tear_distance;
    float air_friction;
    float bend_stiffness;
    ForceFunction apply_force;
    EnergyFunction calc_energy;
    ConstraintFunction solve_constraint;
} Material;

typedef struct {
    float x, y;
    float old_x, old_y;
    float vx, vy;
    float force_x, force_y;
    float mass;
    bool locked;
    void** neighbors;
    int num_neighbors;
    Material* material;
} Particle;

typedef struct {
    Particle *p1, *p2;
    float rest_length;
    float strength;
} Constraint;

// Forward declarations of physics functions
void apply_force_cotton(void* particle, float dt);
void apply_force_silk(void* particle, float dt);
void apply_force_denim(void* particle, float dt);
float calc_energy_cotton(void* particle, void** neighbors, int num_neighbors);
float calc_energy_silk(void* particle, void** neighbors, int num_neighbors);
float calc_energy_denim(void* particle, void** neighbors, int num_neighbors);
void solve_constraint_cotton(void* p1, void* p2, float rest_length);
void solve_constraint_silk(void* p1, void* p2, float rest_length);
void solve_constraint_denim(void* p1, void* p2, float rest_length);

// Define materials with their specific physics functions
const Material COTTON = {
    .elasticity = 0.3f,
    .mass = 1.0f,
    .stiffness = 0.8f,
    .damping = 0.99f,
    .tear_distance = 25.0f,
    .air_friction = 0.02f,
    .bend_stiffness = 0.3f,
    .apply_force = apply_force_cotton,
    .calc_energy = calc_energy_cotton,
    .solve_constraint = solve_constraint_cotton
};

const Material SILK = {
    .elasticity = 0.5f,
    .mass = 0.7f,
    .stiffness = 0.6f,
    .damping = 0.995f,
    .tear_distance = 20.0f,
    .air_friction = 0.03f,
    .bend_stiffness = 0.2f,
    .apply_force = apply_force_silk,
    .calc_energy = calc_energy_silk,
    .solve_constraint = solve_constraint_silk
};

const Material DENIM = {
    .elasticity = 0.1f,
    .mass = 1.5f,
    .stiffness = 0.9f,
    .damping = 0.98f,
    .tear_distance = 35.0f,
    .air_friction = 0.01f,
    .bend_stiffness = 0.7f,
    .apply_force = apply_force_denim,
    .calc_energy = calc_energy_denim,
    .solve_constraint = solve_constraint_denim
};

Particle particles[GRID_WIDTH * GRID_HEIGHT];
Constraint constraints[(GRID_WIDTH - 1) * GRID_HEIGHT + GRID_WIDTH * (GRID_HEIGHT - 1)];
Material current_material = COTTON;
SDL_Point mouse = {0, 0};
bool mouse_down = false;
bool right_click = false;

// Implementation of physics functions
void apply_force_cotton(void* particle_ptr, float dt) {
    Particle* p = (Particle*)particle_ptr;
    if (p->locked) return;

    const float GRAVITY = 980.0f;
    
    // Reset forces
    p->force_x = 0;
    p->force_y = GRAVITY * p->mass;
    
    // Air resistance
    float speed = sqrtf(p->vx * p->vx + p->vy * p->vy);
    if (speed > 0) {
        float air_force = speed * speed * p->material->air_friction;
        p->force_x -= (p->vx / speed) * air_force;
        p->force_y -= (p->vy / speed) * air_force;
    }
    
    // Update velocity and position
    float ax = p->force_x / p->mass;
    float ay = p->force_y / p->mass;
    p->vx = (p->x - p->old_x) / dt + ax * dt;
    p->vy = (p->y - p->old_y) / dt + ay * dt;
    
    float temp_x = p->x;
    float temp_y = p->y;
    p->x += p->vx * dt;
    p->y += p->vy * dt;
    p->old_x = temp_x;
    p->old_y = temp_y;
}

// Similar implementations for silk and denim
void apply_force_silk(void* particle_ptr, float dt) {
    Particle* p = (Particle*)particle_ptr;
    apply_force_cotton(p, dt); // Base implementation with silk-specific adjustments
    p->vx *= p->material->damping;
    p->vy *= p->material->damping;
}

void apply_force_denim(void* particle_ptr, float dt) {
    Particle* p = (Particle*)particle_ptr;
    apply_force_cotton(p, dt); // Base implementation with denim-specific adjustments
    // Add more resistance to movement
    p->vx *= p->material->damping * 0.9f;
    p->vy *= p->material->damping * 0.9f;
}

float calc_energy_cotton(void* particle_ptr, void** neighbors, int num_neighbors) {
    Particle* p = (Particle*)particle_ptr;
    if (p->locked) return 0;
    
    float kinetic = 0.5f * p->mass * (p->vx * p->vx + p->vy * p->vy);
    float potential = p->mass * 980.0f * p->y;
    
    // Add spring potential energy
    float spring = 0;
    for (int i = 0; i < num_neighbors; i++) {
        Particle* n = (Particle*)neighbors[i];
        float dx = n->x - p->x;
        float dy = n->y - p->y;
        float dist = sqrtf(dx * dx + dy * dy);
        spring += 0.5f * p->material->stiffness * (dist - PARTICLE_SPACING) * (dist - PARTICLE_SPACING);
    }
    
    return kinetic + potential + spring;
}

// Similar energy calculations for silk and denim
float calc_energy_silk(void* particle_ptr, void** neighbors, int num_neighbors) {
    return calc_energy_cotton(particle_ptr, neighbors, num_neighbors) * 0.8f;
}

float calc_energy_denim(void* particle_ptr, void** neighbors, int num_neighbors) {
    return calc_energy_cotton(particle_ptr, neighbors, num_neighbors) * 1.2f;
}

void solve_constraint_cotton(void* p1_ptr, void* p2_ptr, float rest_length) {
    Particle* p1 = (Particle*)p1_ptr;
    Particle* p2 = (Particle*)p2_ptr;
    
    float dx = p2->x - p1->x;
    float dy = p2->y - p1->y;
    float dist = sqrtf(dx * dx + dy * dy);
    
    if (dist > 0.0001f) {
        float diff = (dist - rest_length) / dist;
        
        if (!p1->locked) {
            p1->x += dx * diff * 0.5f * p1->material->elasticity;
            p1->y += dy * diff * 0.5f * p1->material->elasticity;
        }
        if (!p2->locked) {
            p2->x -= dx * diff * 0.5f * p2->material->elasticity;
            p2->y -= dy * diff * 0.5f * p2->material->elasticity;
        }
    }
}

// Similar constraint solvers for silk and denim
void solve_constraint_silk(void* p1_ptr, void* p2_ptr, float rest_length) {
    solve_constraint_cotton(p1_ptr, p2_ptr, rest_length);
}

void solve_constraint_denim(void* p1_ptr, void* p2_ptr, float rest_length) {
    solve_constraint_cotton(p1_ptr, p2_ptr, rest_length * 0.9f);
}

void init_particles() {
    // Calculate starting position to center the cloth
    float start_x = (SCREEN_WIDTH - (GRID_WIDTH - 1) * PARTICLE_SPACING) / 2;
    float start_y = (SCREEN_HEIGHT - (GRID_HEIGHT - 1) * PARTICLE_SPACING) / 4; // Place in upper quarter

    for (int y = 0; y < GRID_HEIGHT; y++) {
        for (int x = 0; x < GRID_WIDTH; x++) {
            Particle *p = &particles[y * GRID_WIDTH + x];
            p->x = start_x + x * PARTICLE_SPACING;
            p->y = start_y + y * PARTICLE_SPACING;
            p->old_x = p->x;
            p->old_y = p->y;
            p->vx = p->vy = 0;
            p->force_x = p->force_y = 0;
            p->mass = current_material.mass;
            p->material = &current_material;
            p->locked = (y == 0); // Lock entire top row
            p->neighbors = NULL;
            p->num_neighbors = 0;
        }
    }
}

void init_constraints() {
    int index = 0;
    for (int y = 0; y < GRID_HEIGHT; y++) {
        for (int x = 0; x < GRID_WIDTH - 1; x++) {
            constraints[index++] = (Constraint){
                &particles[y * GRID_WIDTH + x],
                &particles[y * GRID_WIDTH + x + 1],
                PARTICLE_SPACING,
                current_material.stiffness
            };
        }
    }
    for (int y = 0; y < GRID_HEIGHT - 1; y++) {
        for (int x = 0; x < GRID_WIDTH; x++) {
            constraints[index++] = (Constraint){
                &particles[y * GRID_WIDTH + x],
                &particles[(y + 1) * GRID_WIDTH + x],
                PARTICLE_SPACING,
                current_material.stiffness
            };
        }
    }
}

void handle_mouse_interaction() {
    if (!mouse_down) return;
    
    for (int i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
        Particle *p = &particles[i];
        float dx = p->x - mouse.x;
        float dy = p->y - mouse.y;
        float dist = sqrtf(dx * dx + dy * dy);
        
        if (dist < 20.0f && !p->locked) {
            p->x = mouse.x;
            p->y = mouse.y;
            p->old_x = mouse.x;
            p->old_y = mouse.y;
        }
    }
}

void render_cloth(SDL_Renderer *renderer) {
    // Draw constraints
    SDL_SetRenderDrawColor(renderer, 200, 200, 200, 255);
    for (int i = 0; i < (GRID_WIDTH - 1) * GRID_HEIGHT + GRID_WIDTH * (GRID_HEIGHT - 1); i++) {
        Constraint *c = &constraints[i];
        SDL_RenderDrawLine(renderer, 
            (int)c->p1->x, (int)c->p1->y, 
            (int)c->p2->x, (int)c->p2->y);
    }
    
    // Draw particles
    for (int i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
        Particle *p = &particles[i];
        if (p->locked) {
            SDL_SetRenderDrawColor(renderer, 255, 0, 0, 255);
        } else {
            SDL_SetRenderDrawColor(renderer, 100, 100, 100, 255);
        }
        SDL_Rect rect = {(int)p->x - 2, (int)p->y - 2, 4, 4};
        SDL_RenderFillRect(renderer, &rect);
    }
}

int main(int argc, char *argv[]);

int WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    return main(__argc, __argv);
}

int main(int argc, char *argv[]) {
    SDL_Init(SDL_INIT_VIDEO);
    SDL_Window *window = SDL_CreateWindow("Encoded Physics Cloth Simulation",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        SCREEN_WIDTH, SCREEN_HEIGHT, 0);
    SDL_Renderer *renderer = SDL_CreateRenderer(window, -1,
        SDL_RENDERER_ACCELERATED);

    init_particles();
    init_constraints();

    bool running = true;
    SDL_Event event;
    Uint32 last_time = SDL_GetTicks();

    while (running) {
        while (SDL_PollEvent(&event)) {
            if (event.type == SDL_QUIT) {
                running = false;
            } else if (event.type == SDL_MOUSEBUTTONDOWN) {
                mouse_down = true;
                mouse.x = event.button.x;
                mouse.y = event.button.y;
            } else if (event.type == SDL_MOUSEBUTTONUP) {
                mouse_down = false;
            } else if (event.type == SDL_MOUSEMOTION) {
                mouse.x = event.motion.x;
                mouse.y = event.motion.y;
            } else if (event.type == SDL_KEYDOWN) {
                switch (event.key.keysym.sym) {
                    case SDLK_1: current_material = COTTON; break;
                    case SDLK_2: current_material = SILK; break;
                    case SDLK_3: current_material = DENIM; break;
                }
            }
        }

        Uint32 current_time = SDL_GetTicks();
        float dt = (current_time - last_time) / 1000.0f;
        last_time = current_time;

        // Update physics using encoded laws
        for (int i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
            current_material.apply_force(&particles[i], dt);
        }

        handle_mouse_interaction();

        // Solve constraints using material-specific solvers
        for (int j = 0; j < 5; j++) {
            for (int i = 0; i < (GRID_WIDTH - 1) * GRID_HEIGHT + GRID_WIDTH * (GRID_HEIGHT - 1); i++) {
                Constraint* c = &constraints[i];
                current_material.solve_constraint(c->p1, c->p2, c->rest_length);
            }
        }

        SDL_SetRenderDrawColor(renderer, 0, 0, 0, 255);
        SDL_RenderClear(renderer);
        render_cloth(renderer);
        SDL_RenderPresent(renderer);

        SDL_Delay(16);
    }

    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}