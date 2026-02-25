ALTER TABLE public.orders ALTER COLUMN forma_pagamento TYPE text USING forma_pagamento::text;
ALTER TABLE public.orders ALTER COLUMN forma_pagamento SET DEFAULT 'PIX';

ALTER TABLE public.sales ALTER COLUMN forma_pagamento TYPE text USING forma_pagamento::text;
ALTER TABLE public.sales ALTER COLUMN forma_pagamento SET DEFAULT 'PIX';