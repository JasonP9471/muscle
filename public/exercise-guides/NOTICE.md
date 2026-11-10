# Exercise guide imagery

The exercise start/end frames in `library/` are derived from the
[Free Exercise DB](https://github.com/yuhonas/free-exercise-db), an open public-domain
exercise dataset distributed under the Unlicense. The source images are downloaded and
packaged locally so TrainOS does not contact an image service during a workout.

The generated composites are resized and optimized for the TrainOS workout interface.
Seventy movements without an exact source sequence use original, AI-generated TrainOS
imagery. Those custom sequences were reviewed for equipment, grip, stance, body position,
machine orientation, and start/finish accuracy. Their source contact sheets are retained
in `scripts/assets/` for reproducible builds.
