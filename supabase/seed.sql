insert into public.equipment (slug,name) values
  ('barbell','Barbell'),('dumbbell','Dumbbell'),('cable','Cable'),('machine','Machine'),('bodyweight','Bodyweight'),
  ('kettlebell','Kettlebell'),('resistance-band','Resistance band'),('smith-machine','Smith machine'),('cardio-machine','Cardio machine')
on conflict (slug) do update set name=excluded.name;

insert into public.foods (user_id,name,serving_label,calories,protein_g,carbs_g,fat_g,source) values
  (null,'Large egg','1 large egg',72,6.3,0.4,4.8,'built_in'),
  (null,'Grilled chicken breast','6 oz',280,52,0,6,'built_in'),
  (null,'Cooked white rice','1 cup',205,4.3,45,0.4,'built_in'),
  (null,'Nonfat Greek yogurt','1 cup',130,23,9,0,'built_in'),
  (null,'Whey protein powder','1 scoop',120,24,3,2,'built_in');
