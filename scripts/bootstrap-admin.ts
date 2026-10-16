import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio para crear el primer ADMIN`);
  return value;
}

async function main() {
  const activeAdmins = await prisma.userProfile.count({ where: { role: UserRole.ADMIN, active: true } });
  if (activeAdmins > 0) {
    console.log("Ya existe al menos un ADMIN activo. No se realizan cambios.");
    return;
  }

  const entraObjectId = required("BOOTSTRAP_ADMIN_ENTRA_OBJECT_ID");
  const email = required("BOOTSTRAP_ADMIN_EMAIL").toLocaleLowerCase();
  const displayName = required("BOOTSTRAP_ADMIN_DISPLAY_NAME");

  const [byObjectId, byEmail] = await Promise.all([
    prisma.userProfile.findUnique({ where: { entraObjectId } }),
    prisma.userProfile.findUnique({ where: { email } }),
  ]);

  if (byObjectId && byEmail && byObjectId.id !== byEmail.id) {
    throw new Error("El identificador Entra y el email pertenecen a perfiles distintos; revisar antes de continuar");
  }

  const existing = byObjectId ?? byEmail;
  const user = existing
    ? await prisma.userProfile.update({
        where: { id: existing.id },
        data: { entraObjectId, email, displayName, role: UserRole.ADMIN, active: true },
      })
    : await prisma.userProfile.create({
        data: { entraObjectId, email, displayName, role: UserRole.ADMIN, active: true },
      });

  console.log(`Primer ADMIN preparado: ${user.email}`);
}

main()
  .finally(() => prisma.$disconnect());
